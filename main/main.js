const puppeteer = require('puppeteer-extra');
const cron = require('node-cron');
const fs = require('fs');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const async = require("async");
const db_action = require('./db_action')
const slack_notify_bot = require('./slack_notify')

puppeteer.use(StealthPlugin())

const { promisify } = require('util');

const unlinkAsync = promisify(fs.unlink);

let cronJob;
//job inverval 5 minute
let jobInterval = '*/5 * * * *';

const ksRewardPath = "https://www.kickstarter.com/projects/danfornace/rivals-2/rewards";
const chromeAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
const lockFileName = './lockFile.txt';
let slackNotifyMessage = '';
let changedInfoToServer = '';

// Check if pledged money or backer changed since last record
function checkMainPage(callback) {
  (async () => {
    try {

      let browser = await puppeteer.launch({
        headless: 'new', //true mean dont show browser
        defaultViewport: null, // Set viewport explicitly
        args: ['--window-size=1920,1080'], // Set window size explicitly
      });

      // Get the default page (first tab)
      const [page] = await browser.pages();

      // set valid user agent for human checking
      await page.setUserAgent(chromeAgent)

      // go to kickstarter project main page, timeout extend in case connection not good
      await page.goto(ksRewardPath, {timeout: 100000}, { waitUntil: 'domcontentloaded' });

      // get pledged money
      await page.waitForSelector('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div:nth-child(1) > div.flex.items-center > span > span')
      let element = await page.$('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div:nth-child(1) > div.flex.items-center > span > span')
      let pledgedMoney = await page.evaluate(el => el.textContent, element)

      // get number of backer
      await page.waitForSelector('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div.ml5.ml0-lg.mb4-lg > div > span')
      element = await page.$('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div.ml5.ml0-lg.mb4-lg > div > span')
      let backer = await page.evaluate(el => el.textContent, element)

      callback(null, pledgedMoney, backer, browser, page);
    } catch (error) {
      return error; 
    }
  })();
}

async function getMoneyBackerTitleInfo() {
  try {
    let browser = await puppeteer.launch({
      headless: 'new', //true mean dont show browser
      defaultViewport: null, // Set viewport explicitly
      args: ['--window-size=1920,1080'], // Set window size explicitly
    });

    // Get the default page (first tab)
    const [page] = await browser.pages();

    // set valid user agent for human checking
    await page.setUserAgent(chromeAgent)

    // go to kickstarter project main page, timeout extend in case connection not good
    await page.goto(ksRewardPath, {timeout: 100000}, { waitUntil: 'domcontentloaded' });

    // get pledged money
    await page.waitForSelector('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div:nth-child(1) > div.flex.items-center > span > span')
    let element = await page.$('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div:nth-child(1) > div.flex.items-center > span > span')
    let pledgedMoney = await page.evaluate(el => el.textContent, element)

    // get number of backer
    await page.waitForSelector('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div.ml5.ml0-lg.mb4-lg > div > span')
    element = await page.$('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.grid-row.mb5-lg.mb0-md.order1-md.order2-lg > div.grid-col-12.grid-col-4-md.hide.block-lg > div.flex.flex-column-lg.mb4.mb5-sm > div.ml5.ml0-lg.mb4-lg > div > span')
    let backer = await page.evaluate(el => el.textContent, element)

    // get title
    await page.waitForSelector('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.pt7-lg.mt3.mt0-lg.mb6-lg.order2-md.order1-lg > div > div.grid-row.hide.flex-md.flex-column.flex-row-md.relative > div > h2')
    element = await page.$('#react-project-header > div > div.grid-container.flex.flex-column > div.grid-row.pt7-lg.mt3.mt0-lg.mb6-lg.order2-md.order1-lg > div > div.grid-row.hide.flex-md.flex-column.flex-row-md.relative > div > h2')
    let title = await page.evaluate(el => el.textContent, element)

    browser.close();

    let moneyBackerTitleInfo = {
      money: pledgedMoney,
      backer: backer,
      title: title
    }

    return(moneyBackerTitleInfo);
  } catch (error) {
    return error; 
  }
}

// get reward info changed
function checkRewardPage(browser, page, callback) {
  (async () => {
    try {
      // set rewardList empty
      rewardList = [];

      await page.waitForSelector('#react-rewards-tab > div > div.row-start-1.col-start-1.relative > div > div.display-none.pl3.ml-3.rewards-tab--max-h100dvh.auto-scroll.pt2.pt8-md.block-md.col-span-4-md.row-span-2-md.stick-md.t13-md.col-span-3-lg > menu > div:nth-child(1) > ul > li', {timeout: 60000});

      // Get number of rewards
      const rewardNum = await page.$$eval('#react-rewards-tab > div > div.row-start-1.col-start-1.relative > div > div.display-none.pl3.ml-3.rewards-tab--max-h100dvh.auto-scroll.pt2.pt8-md.block-md.col-span-4-md.row-span-2-md.stick-md.t13-md.col-span-3-lg > menu > div:nth-child(1) > ul > li', lis => lis.length);

      console.log(rewardNum);

      let i = 0;
      // loop through every reward
      while (i < rewardNum) {
        let idSelector = '';
        // i == 0 due to first load page auto click to reward 1 make selector change
        if ( i == 0) { 
          idSelector = `#react-rewards-tab > div > div.row-start-1.col-start-1.relative > div > div.display-none.pl3.ml-3.rewards-tab--max-h100dvh.auto-scroll.pt2.pt8-md.block-md.col-span-4-md.row-span-2-md.stick-md.t13-md.col-span-3-lg > menu > div:nth-child(1) > ul > li.mb3.border-left.border-left3px.pl2.ml-2.border-left-create-500 > a`;
        } else {
          idSelector =  `#react-rewards-tab > div > div.row-start-1.col-start-1.relative > div > div.display-none.pl3.ml-3.rewards-tab--max-h100dvh.auto-scroll.pt2.pt8-md.block-md.col-span-4-md.row-span-2-md.stick-md.t13-md.col-span-3-lg > menu > div:nth-child(1) > ul > li:nth-child(${i+1}) > a`;
        }

        // Wait for selector to appear
        await page.waitForSelector(idSelector);
  
        // Get element
        let element = await page.$(idSelector);
  
        // Check if element is not null before accessing its properties
        if (element) {
          // Click element
          await page.click(idSelector);

          // Get reard id
          let hrefInfo = await page.$eval(idSelector, element => element.href);
          hrefInfo = hrefInfo.split('#');
          let rewardId = '#' + hrefInfo[1];
  
          let nameSelector = rewardId + ' > div > div > div > div.p3.pt4 > header > h3';
          let backerSelector = rewardId + ' > div > div > div > div.p3.pt4 > div > div.display-grid.gap4.z1.mt4.grid-cols-2 > div:nth-child(1) > div > div > span:nth-child(1)';

          // Get reward name
          await page.waitForSelector(nameSelector);
          let rewardElement = await page.$(nameSelector);
          let rewardName = await page.evaluate(el => el.textContent, rewardElement);
          
          // Get number of backer
          await page.waitForSelector(backerSelector);
          let backerElement = await page.$(backerSelector)
          let backerNum = await page.evaluate(el => el.textContent, backerElement)

          let rewardInfo = {
            name: rewardName,
            backer: backerNum,
            quantity: 5 // current defaut as 5 because of test phase
          }

          rewardList.push(rewardInfo);

          // increase to next reward
          i++;
        } else {
          console.log('Element not found for selector');
        }
      }

      callback(null, rewardList);
    } catch (error) {
      return error; 
    }
  })();
}

// Check if lock file exists - file exist mean another cronjob is running
const checkLockFile = (callback) => {
  const fileExists = fs.existsSync(lockFileName);
  if (!fileExists) {
    fs.writeFile(lockFileName, '', (err) => {
      if (err) {
        console.error('Error creating file:', err);
      } else {
        console.log('File created successfully.');
      }
    });
    console.log('Lock file does not exist - cron job executed at:', new Date().toISOString());
    callback(null, 'no lock file');
  } else {
    console.log('Lock file exists');
  }
}

// Check the main project page for changes
const checkMainProjectPage = (previousResult, callback) => {
  if (previousResult === 'no lock file') {
    checkMainPage(async (error, pledgedMoney, backer, browser, page) => {
      if (error) {
        callback(error);
      } else {
        const mainPageInfo = {
          backer: parseInt(backer.replace(/,/g, ''), 10),
          pledgedMoney: parseInt(pledgedMoney.replace(/[^\d]/g, ''), 10),
        };

        // check db if record exist
        const db_result = await db_action.findRecord('main', 1);

        // if not exist in db create new one - means changes
        if (db_result === null) {
          await db_action.createBackerPledgedMoneyRecord(mainPageInfo.backer, mainPageInfo.pledgedMoney);
          slackNotifyMessage = 'News from Kickstarter project: \n';
          slackNotifyMessage += `Money changed from 0 to ${mainPageInfo.pledgedMoney}\n`;
          slackNotifyMessage += `Backer change from 0 to ${mainPageInfo.backer}\n\n`;
          callback(null, 'has change', browser, page);
        } else {
          console.log('aa')
          // has changed and start to call reward page
          if (db_result.backer !== mainPageInfo.backer || db_result.pledgedMoney !== mainPageInfo.pledgedMoney) {
            slackNotifyMessage = 'News from Kickstarter project: \n';
            slackNotifyMessage += `Money changed from ${db_result.pledgedMoney} to ${mainPageInfo.pledgedMoney}\n`;
            slackNotifyMessage += `Backer change from ${db_result.backer} to ${mainPageInfo.backer}\n\n`;
            await db_action.updateBackerPledgedMoneyRecord(mainPageInfo.backer, mainPageInfo.pledgedMoney);
            callback(null, 'has change', browser, page);
          } else {
            browser.close();
            callback(null, 'nothing change', browser, page);
          }
        }
      }
    });
  }
};

// Check the reward project page for changes
const checkRewardProjectPage = (previousResult, browser, page, callback) => {
  if (previousResult === 'nothing change') {
    callback(null, 'nothing change');
  } else {
    try {
      // get change info in reward page
      checkRewardPage(browser, page, (error, rewardList) => {
        if (error) {
          callback(error);
        } else {
          browser.close();
          callback(null, rewardList);
        }
      });
    } catch (error) {
      callback(error);
    }
  }
};

// Make reward change action
const makeRewardChangeAction = (previousResult, callback) => {
  if (previousResult === 'nothing change') {
    callback(null, 'nothing change');
  } else {
    try {
      const processChanges = async (rewardChangedList) => {
        const changedInfoList = [];

        // check each reward if had change with db record
        for (let i = 0; i < rewardChangedList.length; i++) {
          const db_result = await db_action.findRecord('reward', rewardChangedList[i].name);
          const changeInfo = { name: '', backer: '' };

          if (db_result !== null) {
            if (db_result.backer !== rewardChangedList[i].backer) {
              changeInfo.name = rewardChangedList[i].name;
              await db_action.updateRewardRecord(rewardChangedList[i].name, rewardChangedList[i].backer, rewardChangedList[i].quantity);

              if (db_result.backer > rewardChangedList[i].backer) {
                changeInfo.backer = `backer decrease from ${db_result.backer} to ${rewardChangedList[i].backer}`;
              } else {
                changeInfo.backer = `backer increase from ${db_result.backer} to ${rewardChangedList[i].backer}`;
              }
            }
          } else {
            await db_action.createRewardRecord(rewardChangedList[i].name, rewardChangedList[i].backer, rewardChangedList[i].quantity);

            changeInfo.name = rewardChangedList[i].name;
            changeInfo.backer = `backer increase from 0 to ${rewardChangedList[i].backer}`;
          }

          changedInfoList.push(changeInfo);
        }

        return changedInfoList;
      };

      processChanges(previousResult).then((result) => {
        callback(null, result);
      });
    } catch (error) {
      callback(error);
    }
  }
};

// Send Slack notification
const sendSlackNotify = (previousResult, callback) => {
  changedInfoToServer = '';
  console.log(`Send Slack notification phase: ${previousResult}`);
  if (previousResult !== 'nothing change') {
    slackNotifyMessage += "Detail as following: \n\n";
    for (let i = 0; i < previousResult.length; i++) {
      if (previousResult[i].backer !== '') {
        slackNotifyMessage += `${previousResult[i].name}\n${previousResult[i].backer}\n\n`;
      }
    }
    slackNotifyMessage += '------------------------------------------------------\n\n\n\n\n';
    slack_notify_bot.sendSlackNotification(slackNotifyMessage);
    changedInfoToServer = previousResult;
    callback(null, 'done job');
  } else {
    callback(null, 'nothing change');
  }
};

// Delete lock file
const deleteLockFile = async (previousResult, callback) => {
  console.log(`Delete lock file phase: ${previousResult}`);
  if (previousResult === 'done job' || previousResult === 'nothing change') {
    try {
      const fileExists = fs.existsSync(lockFileName);
      if (fileExists) {
        await unlinkAsync(lockFileName);
        console.log('Lock file deleted successfully.');
        return 'done cron job';
      } else {
        return 'File does not exist';
      }
    } catch (error) {
      console.error('Error deleting lock file:', error);
      throw error;
    }
  } else {
    return previousResult;
  }
};

// get change in money, backer - along with title for server
function getChangedInfo() {
  return changedInfoToServer;
}

function startJob() {
  // cron job schedule
  cronJob = cron.schedule(jobInterval, () => {
    // async.waterfall to run steps in sequence
    async.waterfall([
      checkLockFile,
      checkMainProjectPage,
      checkRewardProjectPage,
      makeRewardChangeAction,
      sendSlackNotify,
      deleteLockFile,
    ], (err, result) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('Final Result:', result);
      }
    });
  });
}

// Handle Ctrl+C signal
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Stopping cron job and performing cleanup...');

  // stop cronjob
  if (cronJob) {
    cronJob.stop();
    console.log('Cron job stopped.');
  }

  // delete lock file
  try {
    const fileExists = fs.existsSync(lockFileName);
    if (fileExists) {
      unlinkAsync(lockFileName);
      console.log('Lock file deleted successfully.');
    }
  } catch (error) {
    console.error('Error deleting lock file:', error);
  }

  console.log('Cleanup complete. Exiting...');
  process.exit(0);
});

// Call the job to start when first time import module
startJob();

module.exports = {
  startJob,
  getChangedInfo,
  getMoneyBackerTitleInfo
};
