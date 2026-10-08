import React from 'react';
import BuyPostScreen from './BuyPostScreen';
import { POST_SECTIONS } from './postSectionConfig';

const SavedPostsScreen = (props) => <BuyPostScreen {...props} initialTab={POST_SECTIONS.saved.key} />;

export default SavedPostsScreen;
