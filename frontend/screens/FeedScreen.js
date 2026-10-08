import React from 'react';
import BuyPostScreen from './BuyPostScreen';
import { POST_SECTIONS } from './postSectionConfig';

const FeedScreen = (props) => <BuyPostScreen {...props} initialTab={POST_SECTIONS.feed.key} />;

export default FeedScreen;
