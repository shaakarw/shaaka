import { getAuthToken } from '../utils/authStorage';
// screens/BusinessIdeasScreen.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants';

// ---------- Full Translations ----------
const translations = {
  English: {
    headerTitle: 'Shaaka',
    taskTitle: 'Task #77777',
    taskLabelTask: 'Task',
    taskStatusPending: 'Pending',
    taskStatusCompleted: 'Completed',
    taskerHeader: 'Tasker',
    taskerName: 'Shaaka',
    taskerRating: '4.0 reviews',
    conversation: 'Conversation',
    results: 'Results',
    backToShaaka: 'Back to Shaaka',

    findJob: 'Find a Job',
    startBusiness: 'Start a Business',
    learnSkill: 'Learn a Skill',
    aiLoading: 'Loading AI recommendations…',
    aiOffline: 'Business ideas could not be loaded. Check your connection and retry.',
    noBusinessIdeas: 'No business ideas are available right now.',
    retry: 'Retry',
    latestJobs: 'Latest Job Openings',
    businessIdeas: 'Business Ideas & Profits',
    availableCourses: 'Available Courses',
    apply: 'Apply',
    plan: 'Plan',
    enroll: 'Enroll',
    jobDetails: 'Job Details',
    contactApply: 'Contact & Apply',
    website: 'Website',
    linkedin: 'LinkedIn',
    startLearning: 'Start Learning',
    courseWebsite: 'Course Website',
    stepsToStart: 'Steps to Start',
    salary: 'Salary:',
    experience: 'Experience:',
    education: 'Education:',
    deadline: 'Deadline:',
    risk: 'Risk:',
    time: 'Time:',
    startup: 'Startup:',
    profit: 'Profit:',
    certified: 'Certified',
    noCert: 'No Cert',
    close: 'Close',
    you: 'You',
    selecting: 'Selecting...',
    status: 'Status',
    exp: 'Exp:',
    edu: 'Edu:',
    level: 'Level:',
    riskShort: 'Risk:',
    timeShort: 'Time:',
    greeting: "Hi there! I'm Shaaka.\n\nWhat do you want to work on today?",
    finalResponseJob:
      "Great choice! I've loaded the latest job postings below with salaries, deadlines, and contact details.",
    finalResponseBusiness:
      'Excellent! Here are some viable business ideas with startup costs and monthly profits.',
    finalResponseSkill:
      "Awesome! I've listed some high-demand skills with course durations below.",
  },
  Kinyarwanda: {
    headerTitle: 'Shaaka',
    taskTitle: 'Uko urabigenza #',
    taskLabelTask: 'Icyukora',
    taskStatusPending: 'Irategereje',
    taskStatusCompleted: 'Byarangiye',
    taskerHeader: 'Ugufasha',
    taskerName: 'Shaaka',
    taskerRating: '.0 ',
    conversation: 'Ikiganiro',
    results: 'Ibyavuyemo',
    backToShaaka: 'Subira kuri inyuma ',
   
    findJob: 'Gushaka Akazi',
    startBusiness: 'Tangira Ubucuruzi',
    learnSkill: 'Kwige Ubumenyi',
    aiLoading: 'Itegurwa ry\'ibyifuzo bya AI…',
    aiOffline: 'Amakuru y\'ubucuruzi ntiyabonetse. Reba umurongo wongere ugerageze.',
    noBusinessIdeas: 'Nta bitekerezo by\'ubucuruzi bihari ubu.',
    retry: 'Ongera ugerageze',
    latestJobs: 'Imirimo iheruka',
    businessIdeas: 'Ibitekerezo by\'ubucuruzi n\'inyungu',
    availableCourses: 'Amasomo aboneka',
    apply: 'Saba',
    plan: 'Tegura',
    enroll: 'Iyandikishe',
    jobDetails: 'Ibisobanuro by\'akazi',
    contactApply: 'Twandikire usabe',
    website: 'Urubuga',
    linkedin: 'LinkedIn',
    startLearning: 'Tangira kwiga',
    courseWebsite: 'Urubuga rw\'amasomo',
    stepsToStart: 'Intambwe zo gutangira',
    salary: 'Umushahara:',
    experience: 'Ubunararibonye:',
    education: 'Amashuri:',
    deadline: 'Itariki ntarengwa:',
    risk: 'Ingaruka:',
    time: 'Igihe:',
    startup: 'Igishoro:',
    profit: 'Inyungu:',
    certified: 'Yemejwe',
    noCert: 'Nta cyemezo',
    close: 'Funga',
    you: 'Wowe',
    selecting: 'Urahitamo...',
    status: 'Uko bimeze',
    exp: 'Ubunararibonye:',
    edu: 'Amashuri:',
    level: 'Urwego:',
    riskShort: 'Ingaruka:',
    timeShort: 'Igihe:',
    greeting: "Muraho! Ndi Shaaka.\n\nNiki ushaka gukoraho uyu munsi?",
    finalResponseJob:
      "Amahitamo meza! Nshyizeho imirimo iheruka gushyirwa ahagaragara hamwe n'umushahara, itariki ntarengwa, n'amakuru yo kuvugana.",
    finalResponseBusiness:
      "Byiza! Dore ibitekerezo by'ubucuruzi bifite ibiciro bya mbere n'inyungu za buri kwezi.",
    finalResponseSkill:
      "Nibyiza! Nshyizeho ubumenyi bukenerwa cyane hamwe n'igihe cy'amasomo.",
  },
};

// ---------- Chat flow data ----------
const SHAKA_QUESTIONS = [
  {
    id: 'q1',
    type: 'question',
    sender: 'shaka',
    text: null,
    options: null,
  },
];

// ---------- Main Component ----------
const BusinessIdeasScreen = ({ navigation, language = 'English', toggleLanguage }) => {
  const { theme, isDarkMode } = useTheme();
  const isFocused = useIsFocused();
  const t = translations[language] || translations.English;

  const userBubbleColor = isDarkMode ? '#FFFFFF' : '#111111';
  const userBubbleText = isDarkMode ? '#111111' : '#FFFFFF';

  const [initialQuestion, setInitialQuestion] = useState(() => ({
    ...SHAKA_QUESTIONS[0],
    text: t.greeting,
    options: [t.findJob, t.startBusiness, t.learnSkill],
  }));

  const [messages, setMessages] = useState([initialQuestion]);
  const [showTracker, setShowTracker] = useState(false);
  const [userChoice, setUserChoice] = useState('');
  const flatListRef = useRef(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [businessIdeas, setBusinessIdeas] = useState([]);
  const [jobOpenings, setJobOpenings] = useState([]);
  const [skillCourses, setSkillCourses] = useState([]);

  // Update initial question when language changes
  useEffect(() => {
    const newQuestion = {
      ...SHAKA_QUESTIONS[0],
      text: t.greeting,
      options: [t.findJob, t.startBusiness, t.learnSkill],
    };
    setInitialQuestion(newQuestion);
    setMessages([newQuestion]);
    setShowTracker(false);
    setUserChoice('');
  }, [language, t]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);

  // Fetch data from backend
  const fetchBusinessIdeaData = useCallback(async () => {
  setIsLoading(true);
  setErrorMessage('');
  try {
    // Retrieve auth token (optional; some endpoints may not require it)
    const token = await getAuthToken('userToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Fetch all three datasets in parallel from the backend
    const [jobsRes, businessRes, skillsRes] = await Promise.all([
      axios.get(`${BASE_URL}/api/business-ideas/job-openings`, { headers }),
      axios.get(`${BASE_URL}/api/business-ideas/business-ideas`, {
        headers,
        metadata: { disableOfflineFallback: true },
      }),
      axios.get(`${BASE_URL}/api/business-ideas/skill-courses`, { headers }),
    ]);

    const jobs = Array.isArray(jobsRes.data?.jobs) ? jobsRes.data.jobs : [];
    const businessIdeas = Array.isArray(businessRes.data?.businessIdeas) ? businessRes.data.businessIdeas : [];
    const skills = Array.isArray(skillsRes.data?.skills) ? skillsRes.data.skills : [];

    setJobOpenings(jobs);
    setBusinessIdeas(businessIdeas);
    setSkillCourses(skills);
  } catch (error) {
    console.warn('BusinessIdeas fetch error:', error?.response?.data || error?.message || error);
    setErrorMessage(t.aiOffline);
    setBusinessIdeas([]);
  } finally {
    setIsLoading(false);
  }
}, [t]);

  useEffect(() => {
    if (!isFocused) return undefined;
    const timeout = setTimeout(() => fetchBusinessIdeaData(), 0);
    return () => clearTimeout(timeout);
  }, [fetchBusinessIdeaData, isFocused]);

  const handleOptionSelect = async (optionText) => {
    setUserChoice(optionText);
    const userMsg = {
      id: `user_${Date.now()}`,
      type: 'answer',
      sender: 'user',
      text: optionText,
    };
    setMessages((prev) => [...prev, userMsg]);

    await fetchBusinessIdeaData();

    const finalMsg = {
      id: `final_${Date.now()}`,
      type: 'response',
      sender: 'shaka',
      text: getFinalResponse(optionText),
    };
    setTimeout(() => {
      setMessages((prev) => [...prev, finalMsg]);
      setTimeout(() => setShowTracker(true), 600);
    }, 500);
  };

  const getFinalResponse = (choice) => {
    if (choice === t.findJob) return t.finalResponseJob;
    if (choice === t.startBusiness) return t.finalResponseBusiness;
    return t.finalResponseSkill;
  };

  const resetChat = () => {
    setShowTracker(false);
    setMessages([initialQuestion]);
    setUserChoice('');
    setErrorMessage('');
  };

  const openModal = (type, item) => {
    setModalType(type);
    setSelectedItem(item);
    setModalVisible(true);
  };

  const openLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert(t.close, url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  // ---------- Modal Content Renders ----------
  const renderJobModal = () => {
    if (!selectedItem) return null;
    const { title, company, district, salary, exp, edu, deadline, phone, whatsapp, email, website, linkedin } = selectedItem;
    return (
      <View style={styles.modalContent}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>{company} • {district}</Text>
        <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />
        <Text style={[styles.modalSectionHeader, { color: theme.accent }]}>{t.jobDetails}</Text>
        <Text style={[styles.modalText, { color: theme.text }]}>{t.salary} {salary}</Text>
        <Text style={[styles.modalText, { color: theme.text }]}>{t.experience} {exp}</Text>
        <Text style={[styles.modalText, { color: theme.text }]}>{t.education} {edu}</Text>
        <Text style={[styles.modalText, { color: theme.text }]}>{t.deadline} {deadline}</Text>
        <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />
        <Text style={[styles.modalSectionHeader, { color: theme.accent }]}>{t.contactApply}</Text>
        <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
          <Ionicons name="call-outline" size={20} color={theme.accent} />
          <Text style={[styles.contactText, { color: theme.text }]}>{phone}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${phone}`)}>
            <Ionicons name="arrow-forward-circle" size={22} color="#777777" />
          </TouchableOpacity>
        </View>
        <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={[styles.contactText, { color: theme.text }]}>{whatsapp}</Text>
          <TouchableOpacity onPress={() => openLink(`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`)}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#25D366" />
          </TouchableOpacity>
        </View>
        <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
          <Ionicons name="mail-outline" size={20} color={theme.accent} />
          <Text style={[styles.contactText, { color: theme.text }]}>{email}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${email}`)}>
            <Ionicons name="send-outline" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>
        {website && (
          <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
            <Ionicons name="globe-outline" size={20} color={theme.accent} />
            <Text style={[styles.contactText, { color: theme.text }]}>{t.website}</Text>
            <TouchableOpacity onPress={() => openLink(website)}>
              <Ionicons name="open-outline" size={22} color={theme.accent} />
            </TouchableOpacity>
          </View>
        )}
        {linkedin && (
          <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
            <Ionicons name="logo-linkedin" size={20} color="#0A66C2" />
            <Text style={[styles.contactText, { color: theme.text }]}>{t.linkedin}</Text>
            <TouchableOpacity onPress={() => openLink(linkedin)}>
              <Ionicons name="open-outline" size={22} color="#0A66C2" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderBusinessModal = () => {
    if (!selectedItem) return null;
    const { name, cost, profit, risk, time, steps } = selectedItem;
    return (
      <View style={styles.modalContent}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>{name}</Text>
        {!!selectedItem.businessCategory && <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>{selectedItem.businessCategory}</Text>}
        {!!selectedItem.fullDescription && <Text style={[styles.modalText, { color: theme.text }]}>{selectedItem.fullDescription}</Text>}
        <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />
        <View style={styles.modalInfoRow}>
          <Text style={[styles.modalTextBold, { color: theme.accent }]}>{t.startup} {cost}</Text>
          <Text style={[styles.modalTextBold, { color: theme.accent }]}>{t.profit} {profit}</Text>
        </View>
        <Text style={[styles.modalText, { color: theme.text }]}>{t.risk} {risk} • {t.time} {time}</Text>
        <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />
        <Text style={[styles.modalSectionHeader, { color: theme.accent }]}>{t.stepsToStart}</Text>
        {(Array.isArray(steps) ? steps : []).map((step, index) => (
          <View key={index} style={styles.stepItem}>
            <View style={[styles.stepNumberContainer, { backgroundColor: theme.accent }]}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: theme.text }]}>{step}</Text>
          </View>
        ))}
        {[
          ['Target audience', selectedItem.targetAudience],
          ['Required skills', Array.isArray(selectedItem.requiredSkills) ? selectedItem.requiredSkills.join(', ') : ''],
          ['Equipment or materials', Array.isArray(selectedItem.equipment) ? selectedItem.equipment.join(', ') : ''],
          ['Potential customers', Array.isArray(selectedItem.potentialCustomers) ? selectedItem.potentialCustomers.join(', ') : ''],
          ['Marketing strategy', selectedItem.marketingStrategy],
          ['Expected challenges', Array.isArray(selectedItem.challenges) ? selectedItem.challenges.join(', ') : ''],
          ['Location or market', selectedItem.location],
          ['Additional information', selectedItem.additionalInfo],
        ].filter(([, value]) => value).map(([label, value]) => (
          <View key={label} style={{ marginTop: 12 }}>
            <Text style={[styles.modalSectionHeader, { color: theme.accent }]}>{label}</Text>
            <Text style={[styles.modalText, { color: theme.text }]}>{value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSkillModal = () => {
    if (!selectedItem) return null;
    const { name, level, duration, cert, type, contactPhone, contactWhatsapp, email, website } = selectedItem;
    return (
      <View style={styles.modalContent}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>{name}</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>{level} • {duration} • {cert === 'Yes' ? t.certified : t.noCert}</Text>
        <View style={styles.typeBadge}>
          <Text style={[styles.typeBadgeText, { color: type === 'Free' ? theme.text : '#FFF', backgroundColor: type === 'Free' ? theme.action : theme.accent }]}>{type}</Text>
        </View>
        <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />
        <Text style={[styles.modalSectionHeader, { color: theme.accent }]}>{t.startLearning}</Text>
        <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
          <Ionicons name="call-outline" size={20} color={theme.accent} />
          <Text style={[styles.contactText, { color: theme.text }]}>{contactPhone}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${contactPhone}`)}>
            <Ionicons name="arrow-forward-circle" size={22} color="#777777" />
          </TouchableOpacity>
        </View>
        <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={[styles.contactText, { color: theme.text }]}>{contactWhatsapp}</Text>
          <TouchableOpacity onPress={() => openLink(`https://wa.me/${contactWhatsapp.replace(/[^0-9]/g, '')}`)}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#25D366" />
          </TouchableOpacity>
        </View>
        <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
          <Ionicons name="mail-outline" size={20} color={theme.accent} />
          <Text style={[styles.contactText, { color: theme.text }]}>{email}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${email}`)}>
            <Ionicons name="send-outline" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>
        <View style={[styles.contactRow, { backgroundColor: theme.action }]}>
          <Ionicons name="globe-outline" size={20} color={theme.accent} />
          <Text style={[styles.contactText, { color: theme.text }]}>{t.courseWebsite}</Text>
          <TouchableOpacity onPress={() => openLink(website)}>
            <Ionicons name="open-outline" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderModalContent = () => {
    switch (modalType) {
      case 'job': return renderJobModal();
      case 'business': return renderBusinessModal();
      case 'skill': return renderSkillModal();
      default: return null;
    }
  };

  // ---------- Chat Bubble ----------
  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.shaakaRow]}>
        {!isUser && (
          <View style={[styles.avatarCircle, { backgroundColor: theme.accent }]}>
            <Ionicons name="person" size={16} color="#FFF" />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: userBubbleColor }]
              : [styles.shaakaBubble, { backgroundColor: theme.action, borderColor: theme.border }],
          ]}
        >
          <Text style={[styles.messageText, isUser ? { color: userBubbleText } : { color: theme.text }]}>
            {item.text}
          </Text>
          {!isUser && item.options && (
            <View style={styles.optionsContainer}>
              {item.options.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.optionButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => handleOptionSelect(opt)}
                >
                  <Text style={[styles.optionText, { color: theme.accent }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={[styles.timeText, isUser ? { color: isDarkMode ? '#333333' : '#AAAAAA' } : { color: theme.textSecondary }]}>
            {isUser ? t.you : 'Shaaka'}
          </Text>
        </View>
      </View>
    );
  };

  // ---------- Results List ----------
  const renderDynamicContent = () => {
    if (!showTracker) return null;

    return (
      <View style={styles.dynamicListContainer}>
        {isLoading && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t.aiLoading}</Text>
          </View>
        )}
        {errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.action, borderColor: theme.border }]}>
            <Text style={[styles.errorText, { color: theme.text }]}>{errorMessage}</Text>
            <TouchableOpacity onPress={fetchBusinessIdeaData} style={[styles.retryButton, { backgroundColor: theme.accent }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {userChoice === t.findJob && (
          <>
            <Text style={[styles.subHeaderTitle, { color: theme.text }]}>{t.latestJobs}</Text>
            {jobOpenings.map((job) => (
              <View key={job._id || job.id} style={[styles.infoItem, { backgroundColor: theme.action, borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: theme.text }]}>{job.title}</Text>
                  <Text style={[styles.infoSub, { color: theme.textSecondary }]}>{job.company} • {job.district}</Text>
                  <Text style={[styles.infoDetails, { color: theme.textSecondary }]}>{t.exp} {job.exp} | {t.edu} {job.edu}</Text>
                  <View style={[styles.moneyLabel, { marginTop: 4 }]}>
                    <Ionicons name="cash-outline" size={16} color={theme.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.infoDetails, { color: theme.accent, fontWeight: 'bold' }]}>{job.salary}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.accent }]} onPress={() => openModal('job', job)}>
                  <Ionicons name="briefcase-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.actionBtnText}>{t.apply}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {userChoice === t.startBusiness && (
          <>
            <Text style={[styles.subHeaderTitle, { color: theme.text }]}>{t.businessIdeas}</Text>
            {!isLoading && !errorMessage && businessIdeas.length === 0 ? (
              <View style={[styles.emptyBusinessIdeas, { borderColor: theme.border }]}>
                <Ionicons name="bulb-outline" size={28} color={theme.textSecondary} />
                <Text style={[styles.infoSub, { color: theme.textSecondary }]}>{t.noBusinessIdeas}</Text>
              </View>
            ) : null}
            {businessIdeas.map((biz) => (
              <View key={biz._id || biz.id} style={[styles.infoItem, { backgroundColor: theme.action, borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: theme.text }]}>{biz.name}</Text>
                  {!!biz.description && <Text style={[styles.infoSub, { color: theme.textSecondary }]} numberOfLines={2}>{biz.description}</Text>}
                  <Text style={[styles.infoDetails, { color: theme.textSecondary }]}>{t.riskShort} {biz.risk} | {t.timeShort} {biz.time}</Text>
                  <View style={styles.moneyRow}>
                    <View style={styles.moneyLabel}>
                      <Ionicons name="cash-outline" size={16} color={theme.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.infoDetails, { color: theme.accent, fontWeight: 'bold' }]}>{t.startup} {biz.cost}</Text>
                    </View>
                    <View style={styles.moneyLabel}>
                      <Ionicons name="trending-up-outline" size={16} color={theme.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.infoDetails, { color: theme.accent, fontWeight: 'bold' }]}>{t.profit} {biz.profit}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.accent }]} onPress={() => openModal('business', biz)}>
                  <Ionicons name="bulb-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.actionBtnText}>{t.plan}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {userChoice === t.learnSkill && (
          <>
            <Text style={[styles.subHeaderTitle, { color: theme.text }]}>{t.availableCourses}</Text>
            {skillCourses.map((skill) => (
              <View key={skill._id || skill.id} style={[styles.infoItem, { backgroundColor: theme.action, borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: theme.text }]}>{skill.name}</Text>
                  <Text style={[styles.infoDetails, { color: theme.textSecondary }]}>{t.level} {skill.level} | {skill.duration}</Text>
                  <View style={styles.moneyRow}>
                    <Text style={[styles.infoDetails, { backgroundColor: skill.type === 'Free' ? theme.background : theme.accent, color: skill.type === 'Free' ? theme.accent : '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }]}>{skill.type}</Text>
                    <Text style={[styles.infoDetails, { color: theme.accent, fontWeight: 'bold' }]}>{skill.cert === 'Yes' ? '📜 ' + t.certified : t.noCert}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.accent }]} onPress={() => openModal('skill', skill)}>
                  <Ionicons name="school-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.actionBtnText}>{t.enroll}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with back button */}
      <View style={[styles.header, { backgroundColor: 'transparent' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#777777" />
        </TouchableOpacity>
      </View>

      {/* Top static cards */}
      <View style={styles.staticTopContainer}>
        <View style={[styles.taskCard, { backgroundColor: theme.action, borderColor: theme.border }]}>
          <Text style={[styles.taskTitle, { color: theme.text }]}>{t.taskTitle}</Text>
          <View style={styles.taskDetailsRow}>
            <View style={styles.taskDetailItem}>
              <Text style={[styles.taskLabel, { color: theme.textSecondary }]}>{t.taskLabelTask}</Text>
              <Text style={[styles.taskValue, { color: theme.accent }]}>{userChoice || t.selecting}</Text>
            </View>
            <View style={styles.taskDetailItem}>
              <Text style={[styles.taskLabel, { color: theme.textSecondary }]}>{t.status}</Text>
              <Text style={[styles.taskValue, { color: theme.accent }]}>{showTracker ? t.taskStatusCompleted : t.taskStatusPending}</Text>
            </View>
          </View>
        </View>

        {/* TASKER CARD – hidden when results are shown */}
        {!showTracker && (
          <View style={[styles.sectionCard, { backgroundColor: theme.action, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>{t.taskerHeader}</Text>
            <View style={styles.taskerRow}>
              <View style={[styles.taskerAvatar, { backgroundColor: theme.accent }]}>
                <Ionicons name="person" size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.taskerName, { color: theme.text }]}>{t.taskerName}</Text>
                <View style={styles.ratingRow}>
                  {[...Array(4)].map((_, i) => (
                    <Ionicons key={i} name="star" size={12} color={theme.accent} />
                  ))}
                  <Ionicons name="star-outline" size={12} color={theme.textSecondary} />
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Scrollable chat/results */}
      <View style={styles.scrollableContainer}>
        <View style={[styles.sectionCardFull, { backgroundColor: theme.action, borderColor: theme.border }]}>
          <View style={styles.trackerHeaderRow}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>{!showTracker ? t.conversation : t.results}</Text>
            {showTracker && (
              <TouchableOpacity onPress={resetChat} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="arrow-back" size={22} color="#777777" />
                <Text style={[styles.resetBtnText, { color: theme.accent }]}>
                  {t.backToShaaka}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {!showTracker ? (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              ref={flatListRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.chatListContent}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultsScrollContainer}>
              {renderDynamicContent()}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Modal */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color={theme.accent} />
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false}>
              {renderModalContent()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#777777' },
  langButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  langText: { color: '#777777', fontWeight: '700', fontSize: 14, marginLeft: 4 },
  staticTopContainer: { paddingHorizontal: 16, paddingTop: 16 },
  taskCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  taskTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  taskDetailsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  taskDetailItem: { alignItems: 'center', flex: 1 },
  taskLabel: { fontSize: 12, marginBottom: 4 },
  taskValue: { fontSize: 13, fontWeight: '600' },
  sectionCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  sectionHeader: { fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  taskerRow: { flexDirection: 'row', alignItems: 'center' },
  taskerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskerName: { fontSize: 16, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 2 },
  ratingText: { fontSize: 12, marginLeft: 4 },
  scrollableContainer: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  sectionCardFull: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  trackerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resetBtnText: { fontWeight: '600', fontSize: 14 },
  chatListContent: { paddingBottom: 20 },
  messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  shakaRow: { justifyContent: 'flex-start' },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  messageBubble: { maxWidth: '85%', padding: 12, borderRadius: 12 },
  shakaBubble: { borderWidth: 1 },
  userBubble: {},
  messageText: { fontSize: 14, lineHeight: 20 },
  timeText: { fontSize: 10, marginTop: 6, textAlign: 'right' },
  optionsContainer: { marginTop: 10, gap: 8 },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionText: { fontWeight: '600', fontSize: 14 },
  resultsScrollContainer: { paddingBottom: 20 },
  dynamicListContainer: { marginTop: 8 },
  subHeaderTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  infoItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  infoTitle: { fontSize: 16, fontWeight: '600' },
  infoSub: { fontSize: 13, marginBottom: 4 },
  infoDetails: { fontSize: 12 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, width: '80%' },
  moneyLabel: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 33,
    borderRadius: 8,
    justifyContent: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  supportBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  supportBtnText: { fontWeight: '600' },
  manageBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  manageBtnText: { color: '#FFF', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalCloseBtn: { alignSelf: 'flex-end', marginBottom: 10 },
  modalContent: { paddingBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, marginBottom: 12 },
  modalSeparator: { height: 1, marginVertical: 14 },
  modalSectionHeader: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  modalText: { fontSize: 14, marginBottom: 4 },
  modalTextBold: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  contactText: { flex: 1, fontSize: 14 },
  typeBadge: { marginTop: 8, alignSelf: 'flex-start' },
  typeBadgeText: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepNumber: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
  loadingBanner: { paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  loadingText: { marginLeft: 8 },
  errorBanner: {
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, textAlign: 'center' },
  retryButton: { alignSelf: 'center', marginTop: 9, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9 },
  emptyBusinessIdeas: { alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 20, gap: 8 },
});

export default BusinessIdeasScreen;