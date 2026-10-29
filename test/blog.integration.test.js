import test from 'node:test';
import assert from 'node:assert/strict';

// Keep this test opt-in so ordinary unit runs never require MongoDB and never
// touch a real database. Use a disposable local database for the run:
//   RUN_BLOG_INTEGRATION=1 node --test test/blog.integration.test.js
const RUN = process.env.RUN_BLOG_INTEGRATION === '1';
const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/tripod_blog_integration_test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'blog-integration-secret-that-is-long-enough';
process.env.MONGODB_URI = TEST_URI;
process.env.CLIENT_URL = 'https://tripod.example.com';

const { default: mongoose } = await import('mongoose');
const { default: BlogPost } = await import('../src/models/Blog.js');
const { default: BlogCategory } = await import('../src/models/BlogCategory.js');
const {
  createBlogPost,
  updateBlogPost,
  setBlogStatus,
  setBlogFeatured,
  deleteBlogPost,
  findPublishedBlogBySlug,
  listPublicBlogPosts,
  listFeaturedBlogPosts,
  listPublicCategories,
  listPublicTags,
  listRelatedBlogPosts,
  getAdjacentBlogPosts,
  listAdminBlogPosts,
} = await import('../src/services/blogService.js');

test('blog integration: drafts stay private and published articles power public surfaces', { skip: !RUN }, async () => {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all([BlogPost.init(), BlogCategory.init()]);

  try {
    const emptyDraft = await createBlogPost({ title: 'Incomplete draft', status: 'draft' }, { _id: null });
    assert.equal(emptyDraft.status, 'draft');
    assert.equal(emptyDraft.content, '');

    const draft = await createBlogPost({
      title: 'Private recovery draft',
      content: '<p>This must never be public.</p>',
      excerpt: '<p>Private summary</p>',
      category: 'Recovery',
      tags: ['Private', 'Recovery'],
      status: 'draft',
      isFeatured: true,
      seo: { metaTitle: 'Private | Tripod', metaDescription: 'Private description' },
    }, { _id: null });

    assert.equal(draft.status, 'draft');
    assert.equal((await listPublicBlogPosts({})).items.length, 0);
    assert.equal((await listPublicBlogPosts({ q: 'Private' })).items.length, 0);
    assert.equal((await listPublicCategories()).length, 0);
    assert.equal((await listPublicTags()).length, 0);
    assert.equal((await listFeaturedBlogPosts(6)).length, 0);
    await assert.rejects(() => findPublishedBlogBySlug(draft.slug), /not found/i);

    await assert.rejects(
      () => setBlogStatus(draft, 'published'),
      /not ready to publish/i
    );
    // The fixture intentionally has no featured image alt, so remove the
    // featured flag before publishing it for the public-surface assertions.
    await setBlogFeatured(draft, false);
    const published = await setBlogStatus(draft, 'published');
    assert.equal(published.status, 'published');
    assert.equal(Boolean(published.publishedAt), true);
    assert.equal(published.published, true);
    assert.equal(published.readingTime >= 1, true);
    await assert.rejects(() => setBlogFeatured(published, true), /not ready to publish/i);

    const publicList = await listPublicBlogPosts({ page: 1, limit: 10 });
    assert.equal(publicList.items.length, 1);
    assert.equal(publicList.items[0].slug, draft.slug);
    assert.equal((await listPublicCategories())[0].count, 1);
    assert.equal((await listPublicTags())[0].count >= 1, true);
    assert.equal((await findPublishedBlogBySlug(draft.slug)).post._id.toString(), draft._id.toString());

    const second = await createBlogPost({
      title: 'Published recovery guide',
      content: '<p>Another published article.</p>',
      excerpt: '<p>Another summary</p>',
      category: 'Recovery',
      tags: ['Recovery', 'Sleep'],
      status: 'published',
      publishedAt: '2026-09-01T10:00:00.000Z',
    }, { _id: null });
    const hidden = await createBlogPost({
      title: 'Hidden related article',
      content: '<p>Hidden.</p>',
      excerpt: 'Hidden',
      category: 'Recovery',
      tags: ['Recovery'],
      status: 'draft',
    }, { _id: null });

    await updateBlogPost(second, {
      featuredImageUrl: 'https://cdn.example.com/recovery-guide.jpg',
      featuredImageAlt: 'Recovery guide illustration',
    }, { _id: null });
    const featured = await setBlogFeatured(second, true);
    assert.equal(featured.isFeatured, true);
    assert.equal((await listFeaturedBlogPosts(6)).some((item) => item._id.toString() === second._id.toString()), true);
    await setBlogFeatured(second, false);

    const related = await listRelatedBlogPosts(published, 6);
    assert.equal(related.some((item) => item._id.toString() === hidden._id.toString()), false);
    assert.equal(related.some((item) => item._id.toString() === second._id.toString()), true);

    const adjacent = await getAdjacentBlogPosts(published);
    assert.equal(adjacent.previous?._id.toString(), second._id.toString());
    assert.equal(adjacent.next, null);

    const oldSlug = published.slug;
    const renamed = await updateBlogPost(published, {
      slug: 'renamed-recovery-guide',
      excerpt: '<p>Updated summary</p>',
      tags: ['Recovery', 'Sleep'],
    }, { _id: null });
    assert.equal(renamed.slug, 'renamed-recovery-guide');
    assert.equal(renamed.previousSlugs.includes(oldSlug), true);
    const oldLookup = await findPublishedBlogBySlug(oldSlug);
    assert.equal(oldLookup.redirectTo, '/blog/renamed-recovery-guide/');
    assert.equal(oldLookup.post.slug, 'renamed-recovery-guide');

    const admin = await listAdminBlogPosts({ status: 'draft', page: 1, limit: 10 });
    assert.equal(admin.items.some((item) => item._id.toString() === hidden._id.toString()), true);
    assert.equal(admin.items.some((item) => item._id.toString() === renamed._id.toString()), false);

    await setBlogStatus(renamed, 'unpublished');
    assert.equal((await listPublicBlogPosts({})).items.some((item) => item._id.toString() === renamed._id.toString()), false);
    assert.equal((await findPublishedBlogBySlug(renamed.slug).catch(() => 'missing')), 'missing');

    await deleteBlogPost(hidden);
    assert.equal(await BlogPost.exists({ _id: hidden._id }), null);

    // Legacy rows remain readable during the migration window, but only when
    // the old `published` flag says they are live.
    const legacy = mongoose.connection.collection('blogposts');
    await legacy.insertMany([
      {
        title: 'Legacy live', slug: 'legacy-live', category: 'Legacy', tags: ['Legacy'],
        content: '<p>Legacy live body</p>', status: 'active', published: true,
        publishedAt: new Date('2026-08-01T10:00:00.000Z'), createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        title: 'Legacy draft', slug: 'legacy-draft', category: 'Legacy', tags: ['Legacy'],
        content: '<p>Legacy draft body</p>', status: 'active', published: false,
        createdAt: new Date('2026-08-02T10:00:00.000Z'), updatedAt: new Date('2026-08-02T10:00:00.000Z'),
      },
    ]);
    const legacyPublic = await listPublicBlogPosts({ category: 'Legacy' });
    assert.deepEqual(legacyPublic.items.map((item) => item.slug), ['legacy-live']);
    assert.equal((await findPublishedBlogBySlug('legacy-live')).post.slug, 'legacy-live');
    await assert.rejects(() => findPublishedBlogBySlug('legacy-draft'), /not found/i);
    assert.equal((await listPublicTags()).some((tag) => tag.name === 'Legacy' && tag.count === 1), true);
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
