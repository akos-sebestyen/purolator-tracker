const request = require('request');
const cheerio = require('cheerio');

module.exports = function (context, myTimer) {
  const trackingNumber = process.env.TRACKING_NUMBER;

  const getUrl = `http://shipnow.purolator.com/shiponline/track/purolatortrack.asp?pinno=${trackingNumber}`;

  const postURl = 'https://www.purolator.com/en/ship-track/tracking-details.page';

  let jar = request.jar();

  const options = {
    form: {
      pin: trackingNumber,
      lang: 'E'
    },
    jar
  };

  const getOptions = { jar };

  request.get(getUrl, getOptions, function (error, response, body) {
    if(error) return context.done(error);

    request.post(postURl, options, function (error, response, body) {
      if(error) return context.done(error);

      const $ = cheerio.load(body);

      let jsHistoryTable =
          JSON.parse($(`script:contains('${trackingNumber}')`).text().match(/var jsHistoryTable = ([\s\S]*?);/)[1].replace(/'/gm, "\""));

      let data = jsHistoryTable.map(history => {
        let [date, time, location, action] = history;

        return { date, time, location, action }
      });

      let {lastShipmentData} = context.bindings;

      context.log('Current shipment data', data);

      if(lastShipmentData[0]){
        let lastData = JSON.parse(lastShipmentData[0].Data);

        context.log('Last shipment data', lastData);

        let shouldNotify = (data.length > lastData.length);

        context.log('Updates? ', shouldNotify);

        if(shouldNotify){
          context.bindings.textMessage = {
            body: `Updates for ${getUrl}`,
            to: process.env.TO_PHONE_NUMBER,
            from: process.env.FROM_PHONE_NUMBER,
          };
        }
      }

      context.bindings.outTable = [];

      context.bindings.outTable.push({
        PartitionKey: trackingNumber,
        RowKey: (Number.MAX_SAFE_INTEGER - new Date().getTime()).toString(),
        Data: JSON.stringify(data)
      });

      context.done();
    });
  });
    

};