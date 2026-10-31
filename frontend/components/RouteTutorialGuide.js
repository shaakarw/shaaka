import React from 'react';
import ScreenTutorialOverlay from './ScreenTutorialOverlay';
import useScreenTutorial from '../hooks/useScreenTutorial';

const guides = {
  HowItWorks: ['How Shaaka works', 'Learn how to browse listings, connect with people, and use the main Shaaka features.', 'Uko Shaaka ikora', 'Menya uko wareba amatangazo, wavugana n’abandi, kandi ukoresha ibice by’ingenzi bya Shaaka.'],
  BusinessIdeas: ['Business ideas', 'Browse business ideas and open an item to read its details and practical information.', 'Ibitekerezo by’ubucuruzi', 'Reba ibitekerezo by’ubucuruzi hanyuma ufungure icyo uhisemo usome ibisobanuro n’amakuru agufasha.'],
  AddUpdate: ['Add an update', 'Enter an update title and message, review the content, and publish it for your audience.', 'Ongeraho amakuru', 'Andika umutwe n’ubutumwa, ugenzure ibyo wanditse, hanyuma ubisangize abandi.'],
  Notifications: ['Notifications', 'Check account activity and updates. Open a notification to view its details.', 'Imenyesha', 'Reba ibikorwa bya konti n’amakuru mashya. Fungura imenyesha kugira ngo urebe ibisobanuro.'],
  NotificationPreferences: ['Notification settings', 'Choose which notifications you want to receive and save your preferences.', 'Igenamiterere ry’imenyesha', 'Hitamo imenyesha ushaka kwakira hanyuma ubike ibyo wahisemo.'],
  ChangePassword: ['Change password', 'Enter your current password and choose a new one to secure your account.', 'Hindura ijambobanga', 'Andika ijambobanga ukoresha hanyuma uhitemo irishya ryo kurinda konti yawe.'],
  Success: ['Payment complete', 'Review the confirmation details and continue when you are ready.', 'Ubwishyu burarangiye', 'Reba amakuru y’icyemezo hanyuma ukomeze igihe witeguye.'],
  Fail: ['Payment status', 'Review the payment status and follow the available steps to retry or return.', 'Imiterere y’ubwishyu', 'Reba imiterere y’ubwishyu kandi ukurikize intambwe zihari zo kongera kugerageza cyangwa gusubira inyuma.'],
  AddShoppingMallShop: ['Add a mall shop', 'Enter the shop details and publish them so people can find the business.', 'Ongeraho iduka ryo muri mall', 'Andika amakuru y’iduka hanyuma uyatangaze kugira ngo abantu bashobore kuribona.'],
  Feed: ['Community feed', 'Browse posts shared by the community and open a post to read more or interact with it.', 'Ibyatangajwe n’umuryango', 'Reba ibyatangajwe n’umuryango hanyuma ufungure itangazo kugira ngo umenye byinshi cyangwa urisubizeho.'],
  Map: ['Explore the map', 'Browse places on the map, select a listing, and review its location and details.', 'Shakisha ku ikarita', 'Reba ahantu ku ikarita, uhitemo itangazo, kandi urebe aho riherereye n’amakuru ariranga.'],
  MyPosts: ['Your posts', 'Review the posts you have shared and open one to view or manage its details.', 'Ibyo watangaje', 'Reba amatangazo washyizeho hanyuma ufungure iryo ari ryo ryose urebe cyangwa ucunge amakuru yaryo.'],
  Videos: ['Videos and reels', 'Swipe through videos and use the on-screen controls to interact with each post.', 'Amashusho na reels', 'Reba amashusho ukurura ecran kandi ukoreshe ibimenyetso bigaragara kugira ngo ukore ku matangazo.'],
  SavedPosts: ['Saved posts', 'Find posts you saved and open one to review its details.', 'Ibyo wabikije', 'Shaka amatangazo wabikije hanyuma ufungure iryo wahisemo urebe amakuru yaryo.'],
  InstagramChat: ['Instagram chat', 'Review the connected conversation and use the message controls to reply.', 'Ikiganiro cya Instagram', 'Reba ikiganiro gihujwe kandi ukoreshe ibimenyetso by’ubutumwa kugira ngo usubize.'],
  InstagramDMChat: ['Instagram messages', 'Review direct messages and use the message controls to continue the conversation.', 'Ubutumwa bwa Instagram', 'Reba ubutumwa bwihariye kandi ukoreshe ibimenyetso by’ubutumwa kugira ngo ukomeze ikiganiro.'],
  PostDetail: ['Post details', 'Review the photos, description, price, and seller information, then use the available actions.', 'Amakuru y’itangazo', 'Reba amafoto, ibisobanuro, igiciro, n’amakuru y’umucuruzi, hanyuma ukoreshe ibimenyetso bihari.'],
};

const ADMIN_ROUTES = new Set([
  'AdminLogin',
  'AdminDashboard',
  'AdminReports',
  'AdminShops',
  'AdminBusinessAdd',
  'BusinessIdeasAdmin',
  'AddShoppingMallShop',
  'AdminUser',
  'AdminPosts',
  'AdminLiveChat',
  'AdminTutorial',
]);

const screensWithOwnTutorial = new Set([
  'WelcomeHome', 'Search', 'BuyPost', 'Locate', 'AddShop', 'Message', 'Chat', 'Settings',
  'AddPost', 'Login', 'Register', 'ForgotPassword', 'Profile',
]);

export default function RouteTutorialGuide({ routeName, language = 'English' }) {
  const guide = guides[routeName];
  const id = routeName ? `page-${routeName}` : '';
  const [visible, finish] = useScreenTutorial(
    id,
    Boolean(guide && !ADMIN_ROUTES.has(routeName) && !screensWithOwnTutorial.has(routeName))
  );

  if (!guide || ADMIN_ROUTES.has(routeName)) return null;

  return (
    <ScreenTutorialOverlay
      visible={visible}
      steps={[{
        title: language === 'Kinyarwanda' ? guide[2] : guide[0],
        body: language === 'Kinyarwanda' ? guide[3] : guide[1],
      }]}
      language={language}
      onFinish={finish}
    />
  );
}
