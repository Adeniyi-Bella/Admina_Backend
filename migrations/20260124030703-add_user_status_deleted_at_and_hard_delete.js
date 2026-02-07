module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const result = await db.collection('users').updateMany(
      {
        status: { $type: 'object' },
      },
      [
        {
          $set: {
            status: 'active',
            deletedAt: null,
            monthlyQuotaResetAt: new Date(),
          },
        },
      ],
    );

    console.log(
      `Updated ${result.modifiedCount} user documents with new fields.`,
    );

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
    console.log('No rollback for user normalization migration.');
  },
};
