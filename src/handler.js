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
    Object.keys(initSegment.tracks).forEach((trackName) => {
        const track = initSegment.tracks[trackName];
        initSegment_ = track.initSegment;
        if (initSegment_?.byteLength) {
            console.log('initSegment?.byteLength', initSegment_?.byteLength)
            sb.appendBuffer(initSegment_);
        }
    });


    const { data1, data2 } = video;
    let buffer = data1;
    if (data1 && data2) {
        // Combine the moof + mdat so that we buffer with a single append
        const temp = new Uint8Array(data1.length + data2.length);
        temp.set(data1);
        temp.set(data2, data1.length);
        buffer = temp;
    }

    let added = false;
    sb.addEventListener('updateend', () => {
        console.log('buffer.byteLength', buffer.byteLength)
        if (!added) {
            sb.appendBuffer(buffer);
        } else {
            console.log('sb', sb.buffered, ms)
            // ms.endOfStream();
            console.log('ms.duration', ms.duration);
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
