import { query, queryOne, run } from '../config/db.js';
import { safeJsonParse, safeJsonStringify } from '../utils/helpers.js';

export class BlogModel {
  static formatPost(b) {
    if (!b) return null;
    return {
      id: b.id,
      title: b.title,
      slug: b.slug,
      excerpt: b.excerpt,
      content: b.content,
      author: b.author,
      date: b.date,
      readTime: b.read_time,
      category: b.category,
      imageUrl: b.image_url,
      tags: safeJsonParse(b.tags, []),
      commentsCount: b.comments_count,
      createdAt: b.created_at
    };
  }

  static getAll() {
    const posts = query('SELECT * FROM blog_posts ORDER BY created_at DESC');
    return posts.map(this.formatPost);
  }

  static getBySlug(slug) {
    const post = queryOne('SELECT * FROM blog_posts WHERE slug = ? OR id = ?', [slug, slug]);
    if (!post) return null;

    const formatted = this.formatPost(post);
    const comments = query('SELECT * FROM blog_comments WHERE blog_id = ? ORDER BY created_at DESC', [post.id]);

    formatted.comments = comments.map(c => ({
      id: c.id,
      author: c.author_name,
      email: c.email,
      date: c.created_at,
      content: c.comment
    }));

    return formatted;
  }

  static create(data) {
    run(
      `INSERT INTO blog_posts (id, title, slug, excerpt, content, author, date, read_time, category, image_url, tags, comments_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id, data.title, data.slug, data.excerpt, data.content,
        data.author || 'Admin Concierge', data.date || new Date().toISOString().split('T')[0],
        data.readTime || '5 min read', data.category || 'Wellness',
        data.imageUrl || data.image_url || null, safeJsonStringify(data.tags), 0
      ]
    );
    return this.getBySlug(data.slug);
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
    if (data.excerpt !== undefined) { fields.push('excerpt = ?'); values.push(data.excerpt); }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(data.imageUrl); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(safeJsonStringify(data.tags)); }

    if (fields.length === 0) return this.getBySlug(id);

    values.push(id);
    run(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getBySlug(id);
  }

  static addComment(blogId, commentData) {
    run(
      'INSERT INTO blog_comments (id, blog_id, author_name, email, comment) VALUES (?, ?, ?, ?, ?)',
      [commentData.id, blogId, commentData.author, commentData.email, commentData.content]
    );
    run('UPDATE blog_posts SET comments_count = comments_count + 1 WHERE id = ?', [blogId]);
    return true;
  }

  static delete(id) {
    run('DELETE FROM blog_posts WHERE id = ?', [id]);
    return true;
  }
}
