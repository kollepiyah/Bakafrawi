import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setCrf(20); // 18 menghasilkan ±32 MB per 40 dtk; 20 jauh lebih ringan, beda tak terlihat di HP
