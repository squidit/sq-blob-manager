require('dotenv').config({ silent: true });
const BlobManager = require('../lib/blob-manager');
const MediaTypes = BlobManager.StorageManager.MediaTypes;
var fs = require('fs');
var path = require('path');

/**
 *  Implementação de recuperação MOCK
 **/
const storageManager =
  new BlobManager.StorageManager('c17992e8-44b2-41cb-b075-b9f449911e6d');

const mediaType = MediaTypes.PICTURE;
const fileName = 'uploadSampleBlob_150x150.jpg';
const streamPath = path.join(`${__dirname}`, `${fileName}`);
const stream = fs.createReadStream(streamPath);
const streamLength = fs.statSync(streamPath).size;

storageManager.upload(mediaType, fileName, stream, streamLength, (error, result) => {
  const data = {
    err: error,
    res: result,
  };
  console.log(data);

  return true;
});
