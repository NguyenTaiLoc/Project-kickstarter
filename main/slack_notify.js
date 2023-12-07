const axios = require('axios');
const config = require('./config');

// slack Webhook URL
const slackWebhookUrl = config.slack.slackWebHookURL;

async function sendSlackNotification(message) {
  try {
    const response = await axios.post(slackWebhookUrl, {
      text: message,
    });

    console.log('Slack Notification Sent:', response.data);
  } catch (error) {
    console.error('Error Sending Slack Notification:', error.message);
  }
}

module.exports = {
    sendSlackNotification
};