import imageSize from 'image-size';
import * as  mime from 'mime-types';
import readConfig from 'read-config-ng';
import sharp from 'sharp';
import jimp from 'jimp';
import * as  url from 'url';
import stream from './stream.js'

const st = new stream();
const config = readConfig.sync('config/app.json');

let image = class {

  async imageProcessing(res, req, buffer, contentType, modstring) {
    if (buffer.length > 0) {
      let pathname = (url.parse(req.url, false).pathname);
      let extension = pathname.substr(pathname.lastIndexOf('.'));
      let query = url.parse(req.url, true).query;
      // image conversion and quality selection
      let setQuality = !(isNaN((query.q || query.qual || query.quality || "NaN")));
      let quality = (setQuality ? Math.abs((query.q || query.qual || query.quality)) : 100);
      let requestedType = mime.contentType(mime.lookup(extension));
      if (contentType !== requestedType) {
        switch (extension) {
          case ".png":
            buffer = await sharp(buffer).png({ quality: (setQuality ? quality : 100) }).toBuffer();
            contentType = requestedType;
            break;
          case ".jpg":
          case ".jpeg":
            buffer = await sharp(buffer).jpeg({ quality: (setQuality ? quality : 80) }).toBuffer();
            contentType = requestedType;
            break;
          case ".webp":
            buffer = await sharp(buffer).webp({ quality: (setQuality ? quality : 50) }).toBuffer();
            contentType = requestedType;
            break;
          case ".gif":
            buffer = await sharp(buffer).gif().toBuffer();
            contentType = requestedType;
            break;
          case ".avif":
            buffer = await sharp(buffer).avif({ quality: (setQuality ? quality : 80) }).toBuffer();
            contentType = requestedType;
            break;
          case ".tiff":
            buffer = await sharp(buffer).tiff({ quality: (setQuality ? quality : 80) }).toBuffer();
            contentType = requestedType;
            break;
          default:
            break;
        }
      }
      let outputBuffer = buffer;

      if (query.height || query.width || query.h || query.w || query.percent || query.pct || query.p || query.rotation || query.rot || query.r) {

        if ((([".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff"]).includes(extension))) {
          let original = imageSize(buffer);
          let strHeight = query.height || query.h;
          let strWidth = query.width || query.w;
          let strPercent = query.percent || query.pct || query.p;
          let strRotation = query.rotation || query.rot || query.r;
          let height = Math.abs(isNaN(strHeight) ? original.height : strHeight);
          let width = Math.abs(isNaN(strWidth) ? original.width : strWidth);
          let percent = (isNaN(strPercent) ? 0 : (Math.abs(strPercent) / 100));
          let rotation = Math.abs((isNaN(strRotation)) ? 0 : strRotation);

          if (percent > 0) {
            width = Math.abs(original.width * percent);
            height = Math.abs(original.height * percent);
            if (config.server.logToConsole) console.log(width, height);
          } else if (height === original.height && width > 0) {
            height = Math.abs((width / original.width) * original.height);
          } else if (height > 0 && width === original.width) {
            width = Math.abs((height / original.height) * original.width);
          }

          if (rotation > 0 && height === original.height && width === original.width) {
            // rotation only request
            sharp(buffer).rotate(rotation, { background: { r: 255, g: 255, b: 255, alpha: 0.0 } }).toBuffer().then(rotdata => {
              st.streamBuffer(res, req, rotdata, contentType, modstring);
            });
          } else if ((height !== original.height || width !== original.width) && height > 0 && width > 0) {
            sharp(buffer).resize(Math.round(width), Math.round(height), { background: { r: 255, g: 0, b: 0, alpha: 0.0 } }).toBuffer().then(data => {
              if (rotation > 0) {
                // rotation and resize
                sharp(data).rotate(rotation, { background: { r: 255, g: 255, b: 255, alpha: 0.0 } }).toBuffer().then(rotdata => {
                  st.streamBuffer(res, req, rotdata, contentType, modstring);
                });
              } else {
                // resize
                st.streamBuffer(res, req, data, contentType, modstring);
              }
            });
          } else {
            // nothing to do
            st.streamBuffer(res, req, buffer, contentType, modstring);
          }
        } else {
          if (config.server.logToConsole) console.log("not a qualifying file type...");
          st.streamBuffer(res, req, outputBuffer, contentType, modstring);
        }
      } else {
        if (config.server.logToConsole) console.log("no processing requested...");
        st.streamBuffer(res, req, outputBuffer, contentType, modstring);
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found');
      if (config.server.logToConsole) console.log(`Not Found: ${req.url}\nBufferSize: ${buffer.length}`);
      buffer = [];
    }
  }

  async pixel(res, req){
    new jimp(1,1, (err, image) => {
      image.opacity = 0;
      image.getBuffer(jimp.MIME_PNG, (err, buffer) => {
        st.streamBuffer(res, req, buffer, jimp.MIME_PNG, '', true);
      });      
    });
  }
}

export { image, image as default };