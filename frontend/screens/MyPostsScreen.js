import React from 'react';
import BuyPostScreen from './BuyPostScreen';
import { POST_SECTIONS } from './postSectionConfig';

const MyPostsScreen = (props) => <BuyPostScreen {...props} initialTab={POST_SECTIONS.myPosts.key} />;

export default MyPostsScreen;
