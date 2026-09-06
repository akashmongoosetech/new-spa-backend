#!/usr/bin/env node
/**
 * Backfill Excerpts Migration Script
 * 
 * Finds blogs where excerpt is empty and generates it from content.
 * Idempotent: only fills empty excerpts, never overwrites existing.
 * 
 * Usage: node scripts/backfillExcerpts.js
 * Requires: MONGODB_URI environment variable
 */

import { config } from 'dotenv';
import mongoose from 'mongoose';
import { generateExcerpt, getExcerptLength } from '../src/utils/htmlTruncate.js';

config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aura_luxe';

const blogSchema = new mongoose.Schema(
  {
    title: String,
    slug: String,
    content: String,
    excerpt: String,
    summary: String,
    published: Boolean,
    status: String,
  },
  { timestamps: true }
);

const BlogPost = mongoose.model('BlogPost', blogSchema, 'blogposts');

async function run() {
  console.log('🔄 Starting excerpt backfill migration...');
  console.log(`📋 Excerpt length: ${getExcerptLength()} characters`);
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find blogs with empty excerpt
    const blogs = await BlogPost.find({
      $or: [
        { excerpt: { $exists: false } },
        { excerpt: '' },
        { excerpt: null },
      ],
    }).select('title content summary excerpt').lean();
    
    console.log(`📊 Found ${blogs.length} blogs with empty excerpt`);
    
    if (blogs.length === 0) {
      console.log('✨ No blogs need backfilling. Migration complete.');
      return;
    }
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const blog of blogs) {
      try {
        // Use content first, fallback to summary
        const sourceContent = blog.content || blog.summary || '';
        
        if (!sourceContent) {
          console.log(`⚠️  Skipping "${blog.title}" - no content or summary available`);
          skipped++;
          continue;
        }
        
        const generatedExcerpt = generateExcerpt(sourceContent, getExcerptLength());
        
        await BlogPost.updateOne(
          { _id: blog._id },
          { $set: { excerpt: generatedExcerpt } }
        );
        
        console.log(`✅ Updated: "${blog.title}" (${generatedExcerpt.length} chars)`);
        updated++;
        
      } catch (err) {
        console.error(`❌ Error updating "${blog.title}":`, err.message);
        errors++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors:  ${errors}`);
    console.log('\n🎉 Backfill migration complete!');
    
  } catch (err) {
    console.error('💥 Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

run();