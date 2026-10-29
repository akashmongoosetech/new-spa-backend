import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Opt-in HTTP-level coverage for the blog API. It uses a disposable database
// and an ephemeral port:
//   RUN_BLOG_API_E2E=1 node --test test/blog.api.integration.test.js
const RUN = process.env.RUN_BLOG_API_E2E === '1';
const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/tripod_blog_api_integration_test';
const ADMIN_EMAIL = 'blog-api-e2e@example.test';
const ADMIN_PASSWORD = 'BlogTestPass123';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'blog-api-integration-secret-that-is-long-enough';
process.env.MONGODB_URI = TEST_URI;
process.env.CLIENT_URL = 'https://tripod.example.com';
process.env.SITE_URL = 'https://tripod.example.com';

const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { default: AdminUser } = await import('../src/models/AdminUser.js');
const { default: BlogPost } = await import('../src/models/Blog.js');
const { default: BlogCategory } = await import('../src/models/BlogCategory.js');
const { hashPassword } = await import('../src/utils/password.js');

test('blog API integration: auth, draft isolation, publish flow and legacy compatibility', { skip: !RUN }, async () => {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all([AdminUser.init(), BlogPost.init(), BlogCategory.init()]);
  await AdminUser.create({
    name: 'Blog API Tester',
    email: ADMIN_EMAIL,
    password: await hashPassword(ADMIN_PASSWORD),
    role: 'Super Admin',
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const api = `${origin}/api`;

  const request = async (path, { method = 'GET', token, body } = {}) => {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  };

  try {
    const unauthorized = await request('/admin/blogs');
    assert.equal(unauthorized.status, 401);

    const login = await request('/admin/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    assert.equal(login.status, 200);
    assert.equal(typeof login.data?.token, 'string');
    const token = login.data.token;

    // Incomplete drafts are allowed, but they cannot be published.
    const draft = await request('/admin/blogs', {
      method: 'POST',
      token,
      body: { title: 'API incomplete draft', status: 'draft' },
    });
    assert.equal(draft.status, 201);
    assert.equal(draft.data.status, 'draft');
    assert.equal(draft.data.content, '');

    const emptyPublic = await request('/blog/posts');
    assert.equal(emptyPublic.status, 200);
    assert.equal(emptyPublic.data.items.length, 0);

    const publishDraft = await request(`/admin/blogs/${draft.data.id}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'published' },
    });
    assert.equal(publishDraft.status, 400);

    const unsafeCanonical = await request('/admin/blogs', {
      method: 'POST',
      token,
      body: {
        title: 'Unsafe canonical',
        status: 'draft',
        seo: { canonicalUrl: 'http://evil.example.com/blog/unsafe/' },
      },
    });
    assert.equal(unsafeCanonical.status, 400);

    const create = await request('/admin/blogs', {
      method: 'POST',
      token,
      body: {
        title: 'API recovery guide',
        slug: 'api-recovery-guide',
        excerpt: '<p>Recovery summary</p>',
        content: '<script>alert(1)</script><p onclick="alert(2)">Recovery body</p><img src="https://cdn.example.com/guide.jpg" onerror="alert(3)">',
        category: 'Recovery',
        tags: ['Recovery', 'Sleep'],
        author: 'Test Author',
        featuredImageUrl: 'https://cdn.example.com/guide.jpg',
        featuredImageAlt: 'Recovery guide illustration',
        isFeatured: true,
        status: 'draft',
        sections: [
          { id: 'second', heading: 'Second', content: '<p>Second body</p>', order: 2 },
          { id: 'first', heading: 'First', content: '<p>First body</p>', order: 1 },
        ],
        seo: {
          metaTitle: 'API recovery guide | Tripod',
          metaDescription: 'A test article for the Tripod Wellness journal API.',
          canonicalUrl: 'https://tripod.example.com/blog/api-recovery-guide/',
          keywords: ['recovery', 'sleep'],
        },
      },
    });
    assert.equal(create.status, 201);
    const postId = create.data.id;
    assert.equal(create.data.status, 'draft');
    assert.equal(create.data.content.includes('<script'), false);
    assert.equal(/on(?:click|error)=/i.test(create.data.content), false);
    assert.equal(create.data.sections[0].heading, 'First');
    assert.equal(create.data.readingTime >= 1, true);

    const hiddenDraft = await request('/admin/blogs', {
      method: 'POST',
      token,
      body: {
        title: 'API hidden draft',
        content: '<p>Private draft body</p>',
        excerpt: 'Private draft summary',
        category: 'Recovery',
        tags: ['Recovery'],
        status: 'draft',
      },
    });
    assert.equal(hiddenDraft.status, 201);

    const stillHidden = await request('/blog/posts');
    assert.equal(stillHidden.data.items.length, 0);
    const hiddenSearch = await request('/blog/posts?q=Private');
    assert.equal(hiddenSearch.data.items.length, 0);
    assert.deepEqual((await request('/blog/categories')).data, []);
    assert.deepEqual((await request('/blog/tags')).data, []);

    const publish = await request(`/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'published' },
    });
    assert.equal(publish.status, 200);
    assert.equal(publish.data.status, 'published');
    assert.equal(Boolean(publish.data.publishedAt), true);

    const publicList = await request('/blog/posts?limit=999');
    assert.equal(publicList.status, 200);
    assert.equal(publicList.data.pagination.limit, 50);
    assert.equal(publicList.data.items.length, 1);
    assert.equal(publicList.data.items[0].slug, 'api-recovery-guide');

    const publicSearch = await request('/blog/posts?q=Recovery');
    assert.equal(publicSearch.data.items.length, 1);

    const detail = await request('/blog/posts/api-recovery-guide');
    assert.equal(detail.status, 200);
    assert.equal(detail.data.post.slug, 'api-recovery-guide');
    assert.equal(detail.data.post.resolvedSeo.canonicalUrl, 'https://tripod.example.com/blog/api-recovery-guide/');
    assert.equal(detail.data.jsonLd['@type'], 'BlogPosting');
    assert.equal(detail.data.related.length, 0);

    const categories = await request('/blog/categories');
    assert.equal(categories.data.length, 1);
    assert.equal(categories.data[0].count, 1);
    const tags = await request('/blog/tags');
    assert.equal(tags.data.some((tag) => tag.name === 'Recovery' && tag.count === 1), true);

    const sitemap = await request('/blog/sitemap');
    assert.equal(sitemap.status, 200);
    assert.equal(Array.isArray(sitemap.data), true);
    assert.equal(sitemap.data.some((item) => item.slug === 'api-recovery-guide'), true);
    assert.equal(sitemap.data.some((item) => item.slug === hiddenDraft.data.slug), false);
    const sitemapPost = sitemap.data.find((item) => item.slug === 'api-recovery-guide');
    assert.equal(sitemapPost.jsonLd.author.name, 'Test Author');
    assert.equal(sitemapPost.jsonLd.articleSection, 'Recovery');

    const legacy = await request('/blogs/public');
    assert.equal(legacy.status, 200);
    assert.equal(Array.isArray(legacy.data), true);
    assert.equal(legacy.data.length, 1);

    const feature = await request(`/admin/blogs/${postId}/featured`, {
      method: 'PATCH',
      token,
      body: { isFeatured: false },
    });
    assert.equal(feature.status, 200);
    assert.equal(feature.data.isFeatured, false);

    const rename = await request(`/admin/blogs/${postId}`, {
      method: 'PUT',
      token,
      body: { slug: 'api-recovery-guide-renamed' },
    });
    assert.equal(rename.status, 200);
    assert.equal(rename.data.slug, 'api-recovery-guide-renamed');
    assert.equal(rename.data.previousSlugs.includes('api-recovery-guide'), true);

    const oldDetail = await request('/blog/posts/api-recovery-guide');
    assert.equal(oldDetail.status, 200);
    assert.equal(oldDetail.data.redirectTo, '/blog/api-recovery-guide-renamed/');

    const invalidStatus = await request(`/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'active' },
    });
    assert.equal(invalidStatus.status, 400);

    const unpublish = await request(`/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'unpublished' },
    });
    assert.equal(unpublish.status, 200);
    assert.equal(unpublish.data.status, 'unpublished');

    assert.equal((await request('/blog/posts/api-recovery-guide-renamed')).status, 404);
    assert.equal((await request('/blog/posts')).data.items.length, 0);
    assert.equal((await request('/blog/sitemap')).data.length, 0);

    const deleteResponse = await request(`/admin/blogs/${postId}`, { method: 'DELETE', token });
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.data.success, true);

    const deleteDraft = await request(`/admin/blogs/${hiddenDraft.data.id}`, { method: 'DELETE', token });
    assert.equal(deleteDraft.status, 200);
  } finally {
    server.close();
    await new Promise((resolve) => server.once('close', resolve));
    // The controllers intentionally fire-and-forget RAG refreshes. Let them
    // finish before dropping the disposable database and closing the client.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
