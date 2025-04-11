'use strict';
import uploadHelper from './uploadHelper';
import models from './models';


async function getBuffer(fontId){
    const font = await models.font.get(fontId);
    if (font.type === 'user'){
        const stream = await uploadHelper.getStream(font.upload);
        return streamToBuffer(stream);
    }
    return null;
}


async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', data => {
      if (typeof data === 'string') {
        // Convert string to Buffer assuming UTF-8 encoding
        chunks.push(Buffer.from(data, 'utf-8'));
      } else if (data instanceof Buffer) {
        chunks.push(data);
      } else {
        // Convert other data types to JSON and then to a Buffer
        const jsonData = JSON.stringify(data);
        chunks.push(Buffer.from(jsonData, 'utf-8'));
      }
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}


export defaults {
    buffer: getBuffer
}
