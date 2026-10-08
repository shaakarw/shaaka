import React from 'react';
import BuyPostScreen from './BuyPostScreen';
import { POST_SECTIONS } from './postSectionConfig';

const VideosScreen = (props) => <BuyPostScreen {...props} initialTab={POST_SECTIONS.videos.key} />;

export default VideosScreen;
