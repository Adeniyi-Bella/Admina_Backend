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
          cleanUpCompleted: false,
          monthlyQuotaResetAt: Date.now(),
          emailNotification: false,
        },
      },
    );
    console.log(
      `Updated ${result.modifiedCount} user documents with new fields.`,
    );
    const indexResult = await db
      .collection('users')
      .createIndex(
        { permanentDeleteAt: 1 },
        { expireAfterSeconds: 0, background: true },
      );

    console.log(`Created index: ${indexResult}`);

    const docResult = await db.collection('documents').updateMany(
      {
        actionPlans: { $exists: true, $ne: [] },
      },
      {
        $set: {
          'actionPlans.$[].emailNotification': false,
        },
      },
    );
    console.log(
      `Updated ${docResult.modifiedCount} document documents with new fields.`,
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    await db.collection('documents').updateMany(
      {},
      {
        $unset: {
          emailNotification: '',
        },
      },
    );

    console.log(
      "Rollback complete. Note: 'status' fields were preserved to prevent data loss.",
    );
  },
};
