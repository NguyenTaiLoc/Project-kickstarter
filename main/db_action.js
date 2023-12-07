const mysql = require('mysql2/promise');
const { Sequelize, DataTypes } = require('sequelize');
const winston = require('winston');
const config = require('./config');

const dbName = config.database.dbName;
const dbPassword = config.database.dbPassword;
const hostName = config.database.hostName;
const userName = config.database.userName;

// db logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.simple()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'db_log.log' }),
    ],
  });

// Override default console.log and console.error
console.log = function () {
    logger.info.apply(logger, arguments);
};

console.error = function () {
    logger.error.apply(logger, arguments);
};

// Create sequelize instance
const sequelize = new Sequelize(dbName, userName, dbPassword, {
    host: hostName,
    dialect: 'mysql',
    define: {
        // set table name without plural 's' at the end
        freezeTableName: true,
    }
});

// sync all models to database
async function syncModels(log = true) {
    try {
        await sequelize.sync();
        if (log) {
            logger.info('Models synchronized with the database');
        }
    } catch (error) {
        logger.error('Error synchronizing models:', error);
    }
}
  
// Define model for mainTable
const backerPledgedMoneyModel = sequelize.define('backer_pledgedMoney', {
    backer: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    pledgedMoney: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
});

// Define model for rewardTable
const rewardTableModel = sequelize.define('rewards', {
    rewardName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    backer: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    quantityLeft: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
});

// Define model for userTable
const userTableModel = sequelize.define('userInfo', {
    backerName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    mailAddress: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    pledgedType: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    sendMailStatus: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
});

// close databse connection
async function closeDBConnect() {
    sequelize.close()
}

// Function to find record
async function findRecord(type, searchInfo) {
    try {
        let record;

        if (type === 'reward') {
            record = await rewardTableModel.findOne({
                where: {
                    rewardName: searchInfo,
                },
            });
        } else if (type === 'user') {
            record = await userTableModel.findOne({
                where: {
                    backerName: searchInfo,
                },
            });
        } else if (type === 'main') {
            record = await backerPledgedMoneyModel.findByPk(1);
        }

        if (record) {
            logger.info('Record found:', record.toJSON());
        } else {
            logger.info('Record not found');
        }

        return record;
    } catch (error) {
        logger.error('Error finding record:', error);
        throw error; // Re-throw the error to signal the issue
    }
}


// Create backerPledgedMoneyRecord
async function createBackerPledgedMoneyRecord(backer, pledgedMoney) {
    try {
        const createdRecord = await backerPledgedMoneyModel.create({
            backer,
            pledgedMoney,
        });
        logger.log('Record created:', createdRecord.toJSON());
    } catch (error) {
        logger.error('Error creating record:', error);
    }
}

// Create rewardsRecord
async function createRewardRecord(rewardName, backer, quantityLeft) {
    try {
        const createdRecord = await rewardTableModel.create({
            rewardName,
            backer,
            quantityLeft,
        });
        logger.log('Record created:', createdRecord.toJSON());
    } catch (error) {
        logger.error('Error creating record:', error);
    }
}

// Create userRecord
async function createUserRecord(backerName, mailAddress, pledgedType, sendMailStatus) {
    try {
        const createdRecord = await userTableModel.create({
            backerName,
            mailAddress,
            pledgedType,
            sendMailStatus,
        });
        logger.log('Record created:', createdRecord.toJSON());
      } catch (error) {
        logger.error('Error creating record:', error);
    }
}

// Function to update backerPledgedMoneyRecord
async function updateBackerPledgedMoneyRecord(backer, pledgedMoney) {
    try {
        const record = await backerPledgedMoneyModel.findByPk(1);
        if (record) {
            record.backer = backer;
            record.pledgedMoney = pledgedMoney;
            await record.save();
            logger.log('Record updated:', record.toJSON());
        } else {
            await createBackerPledgedMoneyRecord(backer, pledgedMoney);
        }
    } catch (error) {
        logger.error('Error updating record:', error);
    }
}

// Function to update rewardsRecord
async function updateRewardRecord(rewardName, backer, quantityLeft) {
    try {
        const record = await rewardTableModel.findOne({
            where: {
                rewardName: rewardName,
            },
        });

        if (record) {
            record.rewardName = rewardName;
            record.backer = backer;
            record.quantityLeft = quantityLeft;
            await record.save();
            logger.log('Record updated:', record.toJSON());
        } else {
            await createRewardRecord(rewardName, backer, quantityLeft);
        }
    } catch (error) {
        logger.error('Error updating record:', error);
    }
}

// Function to update userRecord
async function updateUserRecord(backerName, mailAddress, pledgedType, sendMailStatus) {
    try {
        const record = await userTableModel.findOne({
            where: {
                backerName: backerName,
            },
        });
        if (record) {
            record.backerName = backerName;
            record.mailAddress = mailAddress;
            record.pledgedType = pledgedType;
            record.sendMailStatus = sendMailStatus;
            await record.save();
            logger.log('Record updated:', record.toJSON());
        } else {
            await createUserRecord(backerName, mailAddress, pledgedType, sendMailStatus);
        }
    } catch (error) {
        logger.error('Error updating record:', error);
    }
}

// Function to delete backerPledgedMoneyRecord
async function deleteBackerPledgedMoneyRecord(record ) {
    try {
        const record = await backerPledgedMoneyModel.findByPk(1);
        if (record) {
          await record.destroy();
          logger.log('Record deleted');
        } else {
          logger.log('Record not found');
        }
    } catch (error) {
        logger.error('Error deleting record:', error);
    }
}

/// Function to delete rewardsRecord
async function deleteRewardRecord(rewardName) {
    try {
        const record = await rewardTableModel.findOne({
            where: {
                rewardName: rewardName,
            },
        });
        if (record) {
            await record.destroy();
            logger.log('Record deleted');
        } else {
            logger.log('Record not found');
        }
    } catch (error) {
        logger.error('Error deleting record:', error);
    }
}

// Function to delete userRecord
async function deleteUserRecord(userName) {
    try {
        const record = await userTableModel.findOne({
            where: {
                backerName: userName,
            },
        });
        if (record) {
            await record.destroy();
            logger.log('Record deleted');
        } else {
            logger.log('Record not found');
        }
    } catch (error) {
        logger.error('Error deleting record:', error);
    }
}

module.exports = {
    syncModels,
    findRecord,
    createBackerPledgedMoneyRecord,
    createRewardRecord,
    createUserRecord,
    updateBackerPledgedMoneyRecord,
    updateRewardRecord,
    updateUserRecord,
    deleteBackerPledgedMoneyRecord,
    deleteRewardRecord,
    deleteUserRecord,
    closeDBConnect
};