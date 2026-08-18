import Setting from '../models/Setting.js';

/**
 * Load the singleton settings document. Creates a default document if none
 * exists (schema defaults provide sensible values).
 */
export async function getSingletonSetting() {
  let doc = await Setting.findOne({ key: 'default' });
  if (!doc) {
    doc = await Setting.create({ key: 'default' });
  }
  return doc;
}

export default { getSingletonSetting };