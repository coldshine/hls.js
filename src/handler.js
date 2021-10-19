import MP4Remuxer from "./remux/mp4-remuxer";
import TSDemuxer from "./demux/tsdemuxer";

export const handler = (ms, data) => {
    const discontinuity = false;
    const trackSwitch = true;
    const contiguous = false;

    let uintData = new Uint8Array(data);

    const remuxer = new MP4Remuxer({
        debug: true,
    });
    const demuxer = new TSDemuxer(undefined, {
        debug: true,
    }, {
        mp4: MediaSource.isTypeSupported('video/mp4'),
        mpeg: MediaSource.isTypeSupported('audio/mpeg'),
        mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"'),
    });

    const audioCodec = 'mp4a.40.29';
    const videoCodec = 'avc1.4d401e';


    // Reset muxers before probing to ensure that their state is clean, even if flushing occurs before a successful probe
    if (discontinuity || trackSwitch) {
        demuxer.resetInitSegment(audioCodec, videoCodec, 0);
        remuxer.resetInitSegment();
    }

    if (discontinuity) {
        demuxer.resetTimeStamp();
        remuxer.resetTimeStamp();
    }

    if (!contiguous) {
        demuxer.resetContiguity();
        remuxer.resetNextTimestamp();
    }

    const { avcTrack } = demuxer.demux(uintData, 0, false, true);
    console.log('avcTrack', avcTrack);
    const remuxResult = remuxer.remux(
        avcTrack,
        0,
        false,
        false,
        'main'
    );
    console.log('remuxResult', remuxResult);

    // -----
    // Buffering
    // -----
    const { video, initSegment } = remuxResult;

    // include levelCodec in audio and video tracks
    const sb = ms.addSourceBuffer(`${initSegment.tracks.video.container};codecs=${initSegment.tracks.video.codec}`);

    // loop through tracks that are going to be provided to bufferController
    let initSegment_;
    const track = initSegment.tracks.video;
    initSegment_ = track.initSegment;
    if (initSegment_.byteLength) {
        console.log('initSegment.byteLength', initSegment_.byteLength)
        sb.appendBuffer(initSegment_);
    }


    const { data1, data2 } = video;
    let buffer = data1;
    if (data1 && data2) {
        // Combine the moof + mdat so that we buffer with a single append
        const temp = new Uint8Array(data1.length + data2.length);
        temp.set(data1);
        temp.set(data2, data1.length);
        buffer = temp;
    }

    let // this is the start of a huge multi-line var decl

        /**
         * Returns the string representation of an ASCII encoded four byte buffer.
         * @param buffer {Uint8Array} a four-byte buffer to translate
         * @return {string} the corresponding string
         */
        parseType = function (buffer) {
            var result = '';
            result += String.fromCharCode(buffer[0]);
            result += String.fromCharCode(buffer[1]);
            result += String.fromCharCode(buffer[2]);
            result += String.fromCharCode(buffer[3]);
            return result;
        },
        nalParse = function (avcStream) {
            var avcView = new DataView(
                    avcStream.buffer,
                    avcStream.byteOffset,
                    avcStream.byteLength
                ),
                result = [],
                i,
                length;
            for (i = 0; i < avcStream.length; i += length) {
                length = avcView.getUint32(i);
                i += 4;
                switch (avcStream[i] & 0x1f) {
                    case 0x01:
                        result.push('NDR');
                        break;
                    case 0x05:
                        result.push('IDR');
                        break;
                    case 0x06:
                        result.push('SEI');
                        break;
                    case 0x07:
                        result.push('SPS');
                        break;
                    case 0x08:
                        result.push('PPS');
                        break;
                    case 0x09:
                        result.push('AUD');
                        break;
                    default:
                        result.push(avcStream[i] & 0x1f);
                        break;
                }
            }
            return result;
        },
        // registry of handlers for individual mp4 box types
        parse = {
            mdat: function (data) {
                return {
                    byteLength: data.byteLength,
                    nals: nalParse(data),
                };
            },
        };

    const mp4toJSON = (data) => {
        let i = 0,
            result = [],
            view = new DataView(data.buffer, data.byteOffset, data.byteLength),
            size,
            type,
            end,
            box;

        while (i < data.byteLength) {
            // parse box data
            size = view.getUint32(i);
            type = parseType(data.subarray(i + 4, i + 8));
            end = size > 1 ? i + size : data.byteLength;

            // parse type-specific data
            box = (
                parse[type] ||
                function (data) {
                    return {
                        data: data,
                    };
                }
            )(data.subarray(i + 8, end));
            box.size = size;
            box.type = type;

            // store this box and move to the next
            result.push(box);
            i = end;
        }
        return result;
    };

    const parsedData = mp4toJSON(data2);

    console.log('>>>> can play stream?', parsedData[0].nals.includes('IDR'));

    let added = false;
    sb.addEventListener('updateend', () => {
        console.log('buffer.byteLength', buffer.byteLength)
        if (!added) {
            console.log('sourceBuffer after appending initSegment', sb.buffered, ms)
            sb.appendBuffer(buffer);
        } else {
            console.log('sourceBuffer after appending video buffer', sb.buffered, ms)
            // ms.endOfStream();
            console.log('mediaSource.duration', ms.duration);
            console.log('Done!')
        }
        added = true;
    });

    sb.addEventListener('onerror', () => {
        console.log('!!!');
    });

    sb.addEventListener('onabort', () => {
        console.log('!!!');
    })

    return { initSegment: initSegment_, buffer }
}
