module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const users = await db.collection('users').find({}).limit(5).toArray();

    console.log('Sample users:', JSON.stringify(users, null, 2));
    
    const result = await db.collection('users').updateMany(
      { status: { $exists: false } },
      {
        $set: {
          status: 'active',
          deletedAt: null,
          permanentDeleteAt: null,
        },
      },
    );

    console.log(`Migrated ${result.modifiedCount} users to new schema.`);

    await db
      .collection('users')
      .createIndex(
        { permanentDeleteAt: 1 },
        { expireAfterSeconds: 0, background: true },
      );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    try {
      await db.collection('users').dropIndex('permanentDeleteAt_1');
    } catch (e) {
      // Ignore error if index doesn't exist
      console.log('Index already dropped or not found');
    }

    console.log(
      "Rollback complete. Note: 'status' fields were preserved to prevent data loss.",
    );
  },
};
