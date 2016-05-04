var fs = require('fs');
var q = require('q');
var moment = require('moment');
var Twit = require('twit');
var PushBullet = require('pushbullet');

var keys = require('./keys');
var storage = require('./data.json');

var twitter = new Twit(keys.twitter);
var push = new PushBullet(keys.pushbullet.access_token);

function storeData() {
    fs.writeFileSync('data.json', JSON.stringify(storage, null, 4));
}

function getDevices() {
    var deferred = q.defer();
    push.devices(function (error, response) {
        if (error) {
            console.log(error);
            return deferred.reject(error);
        }
        deferred.resolve(response);
    });
    return deferred.promise;
}

function pollTweets() {
    var requestData = {
        screen_name: 'Official_PAX',
        trim_user: true
    };
    if (storage.lastTweetId) {
        requestData.since_id = storage.lastTweetId;
    }
    twitter.get('statuses/user_timeline', requestData, function (error, data, response) {
        if (error) {
            console.log(error);
            return;
        }

        var tweets = data
            .filter(function (tweet) {
                return tweet.id > (storage.lastTweetId || 0);
            })
            .map(function (tweet) {
                return {
                    id: tweet.id,
                    text: tweet.text
                }
            });

        if (tweets.length === 0) {
            console.log(moment().format('llll'), 'No new tweets.');
            return;
        }

        tweets.forEach(function (tweet) {
            processTweet(tweet);
        });

        // not sure if sorting is needed, twitter API kind of sucks and isn't clear
        tweets.sort(function (a, b) {
            return (a.id > b.id) ? -1 : ((a.id < b.id) ? 1 : 0);
        });

        storage.lastTweetId = tweets[0].id;
        storeData();
    });
}

function processTweet(tweet) {
    console.log('New tweet', tweet);
    getDevices().then(function (response) {
        response.devices.forEach(function (device) {
            if (device.active && device.pushable) {
                push.note(device.iden, 'PAX', tweet.text, function (error, response) {
                    if (error) {
                        console.log(error);
                        return;
                    }
                    console.log('Pushed tweet ' + tweet.id + ' to device ' + device.nickname + ' at ' + moment().format('llll'));
                });
            }
        });
    });
}

setInterval(pollTweets, 10 * 1000);
