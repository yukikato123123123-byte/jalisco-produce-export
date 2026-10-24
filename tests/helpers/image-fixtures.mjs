import {Buffer} from 'node:buffer';
import {deflateSync} from 'node:zlib';
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
function chunk(tag,bytes){const name=Buffer.from(tag),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(bytes.length);sum.writeUInt32BE(crc(Buffer.concat([name,bytes])));return Buffer.concat([size,name,bytes,sum]);}
export function imagePng(red=60,green=120,blue=80){const width=32,height=24,header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc(height*(1+width*3));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=y*(1+width*3)+1+x*3;pixels[p]=red;pixels[p+1]=green;pixels[p+2]=blue;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);}
