import MP4Remuxer from "./remux/mp4-remuxer";
import TSDemuxer from "./demux/tsdemuxer";
import {handler} from "./handler";

const media1 = document.querySelector('#video1');
const media2 = document.querySelector('#video2');

const MS = MediaSource || WebKitMediaSource;
const ms1 = new MS();
const ms2 = new MS();
// link video and media Source
media1.src = URL.createObjectURL(ms1);
media2.src = URL.createObjectURL(ms2);

media2.addEventListener('seeked', (event) => {
  console.log('seeked', event);
});


console.log('Loading https://seq.lfstrm.tv/frag-bad.ts...')
const xhr2 = new XMLHttpRequest;
xhr2.open('get', 'https://seq.lfstrm.tv/frag-bad.ts');
xhr2.responseType = 'arraybuffer';
xhr2.send();
xhr2.onload = () => {
  console.log('Handling frag-bad.ts...')
  handler(ms2, xhr2.response);
};

// console.log('Loading https://seq.lfstrm.tv/frag-bad.ts...')
// const xhr1 = new XMLHttpRequest;
// xhr1.open('get', 'https://seq.lfstrm.tv/frag-good.ts');
// xhr1.responseType = 'arraybuffer';
// xhr1.send();
// xhr1.onload = () => {
//   console.log('Handling frag-good.ts...')
//   handler(ms1, xhr1.response);
// };
