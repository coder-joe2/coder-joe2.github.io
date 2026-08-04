import React, { useState, useEffect, useRef } from "react";
import { 
  Bus, 
  Search, 
  PlusCircle, 
  Gauge, 
  Info, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  LogOut, 
  Trash2, 
  Edit3, 
  MapPin, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronUp,
  ChevronDown,
  LogIn, 
  Smartphone, 
  Map, 
  User, 
  Lock,
  XCircle,
  Clock,
  ArrowRight,
  Settings,
  Compass,
  Calendar,
  Locate,
  Star,
  ThumbsUp,
  RefreshCw,
  Flag,
  Bell,
  BellRing,
  CheckCheck,
  AlertTriangle
} from "lucide-react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  updateDoc,
  setDoc,
  increment,
  getDocFromServer
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile, 
  GoogleAuthProvider, 
  signInWithPopup,
  sendPasswordResetEmail,
  signInAnonymously
} from "firebase/auth";

// --- TYPES & INTERFACES ---
interface BusStop {
  id: string;
  name: string;      // State/District/City (e.g. Karur, Trichy)
  village: string;   // Country/Village (e.g. Melur, Kattur)
  location: string;  // Bus Name/Number (e.g. 5A, 15B)
  route: string;     // Crowd Type (e.g. High Crowd, Medium Crowd, Low Crowd)
  timings: string[]; // List of timing strings
  gps?: string;      // Lat, Lng coordinates representation
  startRoute?: string; // Route starting point (e.g. Chennai)
  endRoute?: string;   // Route ending point (e.g. Karur)
  addedBy: string;   // User/Author identifier
  creatorId?: string;
  creatorEmail?: string;
  creatorUsername?: string;
  date: string;      // Formatted local date string
  timestamp: number; // Milliseconds for sorting
  activeDays?: string;   // Days of Operation (Active days)
  excludedDays?: string; // Days of Operation (Excluded days)
  likeCount?: number;    // Like count tracking metric
}

interface UserSession {
  uid?: string;
  id?: string;
  username: string;
  name: string;
  email: string;
  photo?: string | null;
  type: string;
}

export interface BusReportNotification {
  id: string;
  stopId: string;
  stopName: string;
  busName: string;
  ownerName: string;
  recipientId?: string | null;
  recipientEmail?: string | null;
  reportedBy: string;
  reason: string;
  details?: string;
  timestamp: string;
  read: boolean;
}

const REPORT_OPTIONS = [
  "Bus was not going the route",
  "Bus name was wrong",
  "Bus timing was wrong",
  "Others"
];

// --- FIREBASE CLIENT API ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_AI_API_KEY || "AIzaSyC_Mg9liHN8zVa0e0W7hr5N_NhnQhPYqUA",
  authDomain: "bus-timing-58180.firebaseapp.com",
  projectId: "bus-timing-58180",
  storageBucket: "bus-timing-58180.firebasestorage.app",
  messagingSenderId: "876150010889",
  appId: "1:876150010889:web:1104b883ebcf8189cab4d8",
  measurementId: "G-6PC1ENSG0S"
};

// Initialize Firebase safely
let db: any = null;
let auth: any = null;
let googleProvider: any = null;
let firebaseInitialized = false;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  // Use the custom database ID directly to connect to your data
  const customDbId = "(default)";
  
  const firestoreSettings = {
    experimentalAutoDetectLongPolling: true,
  };

  try {
    db = (customDbId && customDbId !== "(default)")
      ? initializeFirestore(app, firestoreSettings, customDbId) 
      : initializeFirestore(app, firestoreSettings);
  } catch (initErr) {
    db = getFirestore(app);
  }

  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  firebaseInitialized = true;

  if (db) {
    getDocFromServer(doc(db, "test", "connection")).catch((err) => {
      if (err?.message?.includes("client is offline") || err?.code === "unavailable") {
        console.warn("Firestore running in offline/cache fallback mode:", err?.message || err);
      }
    });
  }

  if (auth && !auth.currentUser) {
    signInAnonymously(auth).catch((err) => {
      console.warn("Anonymous authentication auto-login notice:", err?.message || err);
    });
  }
} catch (error) {
  console.warn("Firebase failed to initialize. Using LocalStorage fallback mode.", error);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Extract and log specific Firebase error code and details to the browser console
  if (error && typeof error === 'object') {
    const errObj = error as any;
    console.error(`[Firebase Firestore Error Detail] Code: "${errObj.code || 'unknown'}", Message: "${errObj.message || 'unknown'}"`, errObj);
  } else {
    console.error(`[Firebase Firestore Error Detail] Non-object or unknown error format:`, error);
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// --- TRANSLATIONS DICTIONARY FOR LOCALIZATION ---
const TRANSLATIONS = {
  en: {
    home_board: "Home Board",
    add_stop: "Add Stop",
    console_hub: "Console Hub",
    wishlist: "Wishlist",
    wishlist_title: "My Starred Wishlist",
    wishlist_desc: "Your favorited bus stop timings for quick offline and online lookup.",
    no_wishlist_title: "No starred stops yet",
    no_wishlist_desc: "Mark stops with a ⭐ star on the Home Board to access them quickly here.",
    about_app: "About App",
    settings: "Settings",
    settings_title: "Settings Center",
    settings_desc: "Manage your preferences, interface themes, and language setups.",
    language_lbl: "Language",
    language_desc: "Choose your interface language / மொழியைத் தேர்ந்தெடுக்கவும்",
    push_notifications: "Notifications",
    push_notifications_desc: "Get notified about newly merged state bus timings",
    offline_caching: "Strict Offline Caching",
    offline_caching_desc: "Cache active routes and coordinates immediately for low coverage areas",
    sign_out: "🚪 SIGN OUT",
    sign_in: "🚪 REGISTER / SIGN-IN",
    
    // TAB-1: All Bus Stops
    tn_bus_timings_board: "TN Bus Timings Board",
    tn_bus_timings_desc: "Find and filter direct village bus schedules and routes contributed by TN locals.",
    search_placeholder: "Search by state name, village, or bus name limits...",
    district_filter: "DISTRICT:",
    all_regions: "ALL REGIONS",
    no_match_title: "No timing boards matched your filters",
    no_match_desc: "Search is case insensitive. Be the first to add this village stop timing to our registry boards!",
    add_timing_stop_btn: "➕ Add Timing Stop",
    tn_registry_board_badge: "TN REGISTRY BOARD",
    bus_name_lbl: "BUS NAME/NO:",
    village_limit_lbl: "VILLAGE LIMIT:",
    more_timings: "more...",
    by_contributor: "By",
    
    // TAB-2: Add or Modify Stop
    edit_bus_stop_title: "✏️ Edit Bus Stop Timing",
    register_bus_stop_title: "➕ Register Bus Stop",
    add_stop_desc: "Enter accurate details. Stops with identical names and locations will auto-merge timings gracefully.",
    district_town_lbl: "District / Town*",
    village_name_lbl: "Village Name*",
    bus_number_lbl: "Bus Number / Name*",
    route_start_end_lbl: "Start to End Route",
    route_start_placeholder: "e.g. Chennai",
    route_end_placeholder: "e.g. Karur",
    active_days_lbl: "Active Days (Days of Operation)*",
    active_days_placeholder: "e.g. Sunday Only, All Days, Weekdays",
    excluded_days_lbl: "Excluded Days (Non-Operating)",
    excluded_days_placeholder: "e.g. Except School Holidays, Saturdays & Sundays",
    route_lbl: "Route",
    crowd_level_lbl: "Crowd Level",
    high_crowd: "🔴 High Crowd (Rush-Hour)",
    medium_crowd: "🟡 Medium (Moderate)",
    low_crowd: "🟢 Low Crowd (Seats Available)",
    departure_timings_lbl: "Departure Timings* (Build schedule list)",
    no_timings_added: "🕒 No bus timings added yet. Create one using the selectors below!",
    configure_departure: "Configure New Departure Time",
    select_wheels: "Select the time using properties below",
    hour_lbl: "Hour",
    minute_lbl: "Minute",
    period_lbl: "Period (AM/PM)",
    add_departure_btn: "Add Departure Time",
    coordinates_lbl: "Coordinates & Map Pin (Optional)",
    gps_placeholder: "Click to type manually: Lat, Lng",
    choose_map_btn: "Choose on Satellite Map",
    gps_pinned_desc: "Coordinates pin attached! Ready for route search of custom user stops.",
    undo_edit_btn: "UNDO EDIT",
    update_board_btn: "🔄 UPDATE BOARD ENTRY",
    save_timing_btn: "✅ SAVE TIMING DETAILS",
    
    // TAB-3: Console
    console_command_hub: "Console Command Hub",
    console_desc: "Manage, edit, or wipe custom bus stop details contributed from your user account.",
    login_required_hub: "Login Required for Control Hub",
    login_required_add_stop: "Login Required for Add Stop",
    login_required_desc: "You must authenticate. Login to synchronize edits and track your contributed village bus stops in real-time.",
    login_securely_btn: "🔒 Login Securely",
    contributor_identity_lbl: "Contributor Identity",
    saved_contributions_lbl: "Your Saved Contributions",
    system_maintenance: "⚠️ System Maintenance Utilities",
    system_maintenance_desc: "Perform routine formatting. You can wipe all bus timings authored under your registered account name below.",
    clean_my_listed: "🗑️ CLEAN MY LISTED BUS TIMINGS",
    contributions_history: "Contributions History Log",
    no_contributions_yet: "You have not submitted any timetables yet in this session.",
    add_first_stop_btn: "➕ Add My First Stop",
    edit_lbl: "Edit",
    delete_lbl: "Wipe",
    technical_queries: "Need immediate technical query resolutions?",
    contact_admin: "✉️ Contact Admin Support:",
    
    // TAB-4: About
    about_title: "About User Stop Bus Stop Registry",
    about_p1: "Welcome to the local citizen User Stop Bus Stop Registry platform!",
    about_p2: "This service is built for daily travelers in state towns (and villages) including Karur, Trichy, Tanjore, and neighboring hamlets. Commuters frequently face delay queries due to inconsistent state timing databases.",
    about_p3: "To solve this, our interactive registry gathers accurate timelines in real-time, allowing users like you to list schedules, pin precise map coordinates, and specify crowd densities.",
    about_p4: "Our search directory adapts to high-speed lists, working offline automatically on mobile browsers so you can find local buses while on the move.",
    registry_policy: "Registry Policy Queries",
    about_footer_desc: "For requests, bulk imports, reports, or to coordinate maps integration, drop us an official mail to:",
    interactive_map: "Interactive map",
    gps_pin_point: "GPS Pin Point Coordinates",
    merging_logic: "Merging logic",
    no_duplication: "No timing lists duplication",
    
    // TAB-5: Auth Detail
    register_login: "Register or Sync Securely",
    auth_desc: "Register a unique nickname below. Any submittals you contribute will be pinned to this pseudonym for real-time tracking.",
    current_identity: "Current Active Identity",
    logged_in_as: "You are recognized as",
    switch_profile_btn: "🚪 Switch Nickname Session",
    nickname_lbl: "Set Your Contributor Nickname*",
    nickname_placeholder: "e.g. KarurRider, TrichyLocal99",
    create_session_btn: "🔐 Initialize Authenticated Session",
    verified_contributor: "Verified Active Contributor",
    go_to_bus_boards: "🚌 GO TO BUS BOARDS",
    sign_out_securely: "🚪 SIGN OUT SECURELY",
    forgot_password: "Forgot Password?",
    enter_email_reset: "Enter your registered email below, and we will send you a secure link to reset your password.",
    email_address: "Email Address",
    cancel_btn: "Cancel",
    send_link: "Send Link",
    sending_link: "Sending Link...",
    member_login: "MEMBER LOGIN",
    member_registration: "MEMBER REGISTRATION",
    full_name: "Full Name",
    username: "Username/Email",
    show_password: "Show password",
    password_lbl: "Password",
    login_btn: "Login",
    register_btn: "Register",
    not_a_member: "Not a member?",
    already_a_member: "Already a member?",
    create_account: "Create account",
    sign_in_google: "Sign In with Google",
    
    // Detail View page
    back_to_board: "Back to board",
    detail_missing: "Timing board details missing or database reset.",
    user_stop_badge: "BUS REGISTRY AT USER STOP",
    bus_name_no_lbl: "BUS NAME / NO",
    village_area_limits: "VILLAGE AREA LIMITS",
    departing_timings_title: "Departing Timings Schedule",
    interactive_map_title: "Interactive Map Location",
    open_google_maps: "OPEN LIVE GOOGLE MAPS DIRECTIONS",
    no_gps_location: "No GPS Location coordinates pinned for this timing yet.",
    contributed_by_footer: "Contributed by",
    on_date: "on",
  },
  ta: {
    home_board: "முகப்பு பலகை",
    add_stop: "நேரம் சேர்க்க",
    console_hub: "நிர்வாக மையம்",
    wishlist: "விருப்பப்பட்டியல்",
    wishlist_title: "எனது விருப்பப்பட்டியல்",
    wishlist_desc: "எளிதாகக் கண்டறிய உங்கள் நட்சத்திரக் குறியிட்ட பேருந்து நிறுத்த அட்டவணைகள்.",
    no_wishlist_title: "விருப்பப்பட்டியலில் எதுவும் இல்லை",
    no_wishlist_desc: "முகப்பு பலகையில் உள்ள பேருந்து நிறுத்தங்களின் நட்சத்திர குறியை (⭐) அழுத்தி இங்கு எளிதாகக் கண்டறியவும்.",
    about_app: "செயலியைப் பற்றி",
    settings: "அமைப்புகள்",
    settings_title: "அமைப்புகள் மையம்",
    settings_desc: "உங்கள் பயணத்தேர்வுகள், இடைமுக தீம்கள் மற்றும் மொழி அமைப்புகளை நிர்வகிக்கவும்.",
    language_lbl: "மொழி",
    language_desc: "உங்கள் பயன்பாட்டு மொழியைத் தேர்ந்தெடுக்கவும்",
    push_notifications: "அறிவிப்புகள்",
    push_notifications_desc: "புதிதாகச் சேர்க்கப்படும் பேருந்து நேரங்களின் அறிவிப்புகளைப் பெறுங்கள்",
    offline_caching: "முழு ஆஃப்லைன் சேமிப்பு",
    offline_caching_desc: "இணைய வசதி குறைவாக இருந்தாலும் பார்க்க பேருந்து தடங்களைச் சேமித்து வைக்கவும்",
    sign_out: "🚪 வெளியேறு",
    sign_in: "🚪 உள்நுழைய / பதிவுசெய்ய",
    
    // TAB-1: All Bus Stops
    tn_bus_timings_board: "தமிழ்நாடு பேருந்து நேர பலகை",
    tn_bus_timings_desc: "தமிழ்நாடு மக்களின் பங்களிப்புடன் நேரடி கிராமப்புற பேருந்து நேரங்களையும் புதிய வழித்தடங்களையும் கண்டறியவும்.",
    search_placeholder: "மாவட்டம், ஊர் பெயர் அல்லது பேருந்து பெயர் கொண்டு தேடவும்...",
    district_filter: "மாவட்டம்:",
    all_regions: "அனைத்துப் பகுதிகள்",
    no_match_title: "எந்தப் பேருந்து நேரமும் உங்கள் தேடலுக்குப் பொருந்தவில்லை",
    no_match_desc: "தேடல் எழுத்து வேறுபாடு அற்றது. உங்கள் ஊர் பேருந்து நேரத்தை உடனே எங்கள் பலகையில் சேர்க்கவும்!",
    add_timing_stop_btn: "➕ பேருந்து நேரம் சேர்க்க",
    tn_registry_board_badge: "தமிழ்நாடு பதிவக பலகை",
    bus_name_lbl: "பேருந்து பெயர்/எண்:",
    village_limit_lbl: "ஊரின் எல்லை:",
    more_timings: "கூடுதல் நேரங்கள்...",
    by_contributor: "பங்களிப்பாளர்",
    
    // TAB-2: Add or Modify Stop
    edit_bus_stop_title: "✏️ பேருந்து நேரத்தைத் திருத்தவும்",
    register_bus_stop_title: "➕ புதிய பேருந்து நிலையத்தைப் பதிவுசெய்க",
    add_stop_desc: "துல்லியமான விபரங்களை உள்ளிடவும். ஒரே பெயரையும் இடத்தையும் கொண்ட பேருந்து நிறுத்தங்கள் தானாகவே ஒன்றிணைக்கப்படும்.",
    district_town_lbl: "மாவட்டம் / நகரம்*",
    village_name_lbl: "ஊர் பெயர்*",
    bus_number_lbl: "பேருந்து எண் / பெயர்*",
    route_start_end_lbl: "ஆரம்பிக்கும் இடம் முதல் சேரும் இடம் வரை (Start to End)",
    route_start_placeholder: "எ.கா. சென்னை",
    route_end_placeholder: "எ.கா. கரூர்",
    active_days_lbl: "இயங்கும் நாட்கள் (Active Days)*",
    active_days_placeholder: "எ.கா. ஞாயிற்றுக்கிழமை மட்டும், அனைத்து நாட்களும், வார நாட்கள்",
    excluded_days_lbl: "தவிர்க்கப்பட்ட நாட்கள் (Excluded Days)",
    excluded_days_placeholder: "எ.கா. பள்ளி விடுமுறை நாட்கள் தவிர, சனி மற்றும் ஞாயிறு தவிர",
    route_lbl: "வழித்தடம்",
    crowd_level_lbl: "கூட்ட நெரிசல் அளவு",
    high_crowd: "🔴 அதிக நெரிசல் (நெரிசல் நேரம்)",
    medium_crowd: "🟡 நடுத்தரம் (மிதமானது)",
    low_crowd: "🟢 குறைந்த நெரிசல் (இருக்கைகள் உள்ளன)",
    departure_timings_lbl: "புறப்படும் நேரங்கள்* (பட்டியலை உருவாக்கவும்)",
    no_timings_added: "🕒 இதுவரை பேருந்து நேரங்கள் சேர்க்கப்படவில்லை. கீழே உள்ளவற்றைத் தேர்ந்தெடுத்து உருவாக்கவும்!",
    configure_departure: "புதிய புறப்பாட்டு நேரத்தை அமைக்கவும்",
    select_wheels: "கீழே உள்ள எண்களைக் கொண்டு நேரத்தைத் தேர்ந்தெடுக்கவும்",
    hour_lbl: "மணி",
    minute_lbl: "நிமிடம்",
    period_lbl: "காலம் (AM/PM)",
    add_departure_btn: "புறப்பாட்டு நேரத்தைச் சேர்க்கவும்",
    coordinates_lbl: "வரைபட அச்சு & இருப்பிடம் (விருப்பத்தேர்வு)",
    gps_placeholder: "கைமுறையாக உள்ளிட: அட்சரேகை, தீர்க்கரேகை",
    choose_map_btn: "செயற்கைக்கோள் வரைபடத்தில் தேர்வு செய்க",
    gps_pinned_desc: "வரைபட இருப்பிடம் இணைக்கப்பட்டது! வழித்தடத் தேடலுக்குத் தயாராக உள்ளது.",
    undo_edit_btn: "மாற்றங்களை ரத்து செய்",
    update_board_btn: "🔄 பதிவை மாற்றியமைக்கவும்",
    save_timing_btn: "✅ பேருந்து நேரத்தைச் சேமிக்கவும்",
    
    // TAB-3: Console
    console_command_hub: "நிர்வாகக் கட்டுப்பாட்டு மையம்",
    console_desc: "உங்கள் கணக்கிலிருந்து பதிவேற்றப்பட்ட பேருந்து நிறுத்த விபரங்களை நிர்வகிக்கவும், திருத்தவும் அல்லது அழிக்கவும்.",
    login_required_hub: "கட்டுப்பாட்டு மையத்திற்கு உள்நுழைவு அவசியம்",
    login_required_add_stop: "புதிய நிறுத்தத்தைச் சேர்க்க உள்நுழைவு அவசியம்",
    login_required_desc: "மாற்றங்களைச் சேமிக்கவும் உங்கள் பங்களிப்புகளை உடனுக்குடன் கண்காணிக்கவும் உள்நுழைய வேண்டும்.",
    login_securely_btn: "🔒 பாதுகாப்பாக உள்நுழைக",
    contributor_identity_lbl: "பங்களிப்பாளர் அடையாளம்",
    saved_contributions_lbl: "உங்கள் மொத்தப் பங்களிப்புகள்",
    system_maintenance: "⚠️ கணினி பராமரிப்புப் பலகை",
    system_maintenance_desc: "உங்கள் கணக்கின் கீழ் பதிவு செய்யப்பட்ட அனைத்து பேருந்து நேரங்களையும் நீங்கள் கீழே முற்றிலுமாக அழிக்கலாம்.",
    clean_my_listed: "🗑️ எனது அனைத்துப் பேருந்து நேரங்களையும் அழி",
    contributions_history: "பங்களிப்பு வரலாறு",
    no_contributions_yet: "இந்த அமர்வில் நீங்கள் இன்னும் எந்தப் பேருந்து தடங்களையும் பதிவேற்றவில்லை.",
    add_first_stop_btn: "➕ எனது முதல் நிறுத்தத்தைச் சேர்",
    edit_lbl: "தொகு",
    delete_lbl: "அழி",
    technical_queries: "உடனடி தொழில்நுட்ப உதவி தேவையா?",
    contact_admin: "✉️ நிர்வாக ஆதரவைத் தொடர்பு கொள்ளவும்:",
    
    // TAB-4: About
    about_title: "செயலியைப் பற்றி - User Stop பேருந்து நேரப் பதிவகம்",
    about_p1: "உள்ளூர் பொது மக்கள் தங்களின் ஊர் பேருந்து நேரங்களைப் பகிர்ந்து கொள்ளும் User Stop தளத்திற்கு உங்களை வரவேற்கிறோம்!",
    about_p2: "இந்தச் சேவை கரூர், திருச்சி, தஞ்சாவூர் மற்றும் சுற்றியுள்ள கிராமப்பகுதிகளில் தினசரி பயணம் செய்யும் பயணிகளுக்காக உருவாக்கப்பட்டது. சரியான நேர விபரங்கள் கிடைக்காமல் பயணிகள் அவதிப்படுவதைத் தடுக்க இது லகுவான வழியைத் தருகிறது.",
    about_p3: "எங்களின் இந்த ஊடாடும் பதிவேடு மூலமாக நேரடி பேருந்து வழித்தடங்கள், வரைபட இருப்பிடங்கள் மற்றும் கூட்ட நெரிசல் நிலைகளை நீங்களே பதிவேற்றிப் பகிரலாம்.",
    about_p4: "எங்கள் தேடல் தளம் மொபைல் பிரௌசர்களில் ஆஃப்லைனிலும் இயங்கும் வண்ணம் மேம்படுத்தப்பட்டுள்ளது.",
    registry_policy: "பதிவுக் கொள்கை வினாக்கள்",
    about_footer_desc: "For requests, bulk imports, reports, or to coordinate maps integration, drop us official mail below:",
    interactive_map: "ஊடாடும் வரைபடம்",
    gps_pin_point: "வரைபட அச்சு இருப்பிடம்",
    merging_logic: "ஒன்றிணைக்கும் தளம்",
    no_duplication: "விபரங்கள் நகலாகாமல் தடுக்கும்",
    
    // TAB-5: Auth Detail
    register_login: "பாதுகாப்பாகப் பதிவு செய்யவும் / ஒத்திசைக்கவும்",
    auth_desc: "கீழே உங்கள் புனைப்பெயரைப் பதிவு செய்யவும். நீங்கள் செய்யும் பங்களிப்புகள் இந்த பெயருடன் இணைக்கப்படும்.",
    current_identity: "தற்போதைய பயனர் சுயவிவரம்",
    logged_in_as: "நீங்கள் உள்நுழைந்துள்ள பெயர்:",
    switch_profile_btn: "🚪 புனைப்பெயரை மாற்றவும்",
    nickname_lbl: "உங்கள் பங்களிப்பாளர் புனைப்பெயர்*",
    nickname_placeholder: "எ.கா. KarurRider, TrichyLocal99",
    create_session_btn: "🔐 அங்கீகரிக்கப்பட்ட அமர்வை உருவாக்கு",
    verified_contributor: "விவரம் சரிபார்க்கப்பட்ட செயலில் உள்ள பங்களிப்பாளர்",
    go_to_bus_boards: "🚌 பேருந்து பலகைக்குச் செல்",
    sign_out_securely: "🚪 பாதுகாப்பாக வெளியேறு",
    forgot_password: "கடவுச்சொல் மறந்துவிட்டதா?",
    enter_email_reset: "உங்கள் பதிவுசெய்த மின்னஞ்சலை உள்ளிடவும், கடவுச்சொல்லை மீட்டமைக்க ஒரு இணைப்பை அனுப்புவோம்.",
    email_address: "மின்னஞ்சல் முகவரி",
    cancel_btn: "ரத்து செய்",
    send_link: "இணைப்பை அனுப்பு",
    sending_link: "அனுப்பப்படுகிறது...",
    member_login: "உறுப்பினர் உள்நுழைவு",
    member_registration: "உறுப்பினர் பதிவு",
    full_name: "முழு பெயர்",
    username: "பயனர் பெயர் / மின்னஞ்சல்",
    show_password: "கடவுச்சொல்லைக் காட்டு",
    password_lbl: "கடவுச்சொல்",
    login_btn: "உள்நுழை",
    register_btn: "பதிவு செய்",
    not_a_member: "உறுப்பினர் இல்லையா?",
    already_a_member: "ஏற்கனவே உறுப்பினரா?",
    create_account: "கணக்கை உருவாக்கு",
    sign_in_google: "கூகிள் மூலம் உள்நுழைக",
    
    // Detail View page
    back_to_board: "முகப்புப் பலகைக்குத் திரும்பு",
    detail_missing: "பேருந்து நிறுத்த விபரங்கள் இல்லை அல்லது அழிந்துவிட்டன.",
    user_stop_badge: "user stop-ல் பேருந்துப் பதிவகம்",
    bus_name_no_lbl: "பேருந்து பெயர் / எண்",
    village_area_limits: "ஊரின் எல்லைப் பகுதிகள்",
    departing_timings_title: "புறப்படும் நேரங்களின் அட்டவணை",
    interactive_map_title: "ஊடாடும் வரைபடம்",
    open_google_maps: "கூகுள் மேப்ஸ் மூலம் வழியைக் காட்டு",
    no_gps_location: "இந்த நிறுத்தத்திற்கு வரைபட அச்சு இன்னும் இணைக்கப்படவில்லை.",
    contributed_by_footer: "பங்களித்தவர்",
    on_date: "நாள்",
  }
};

// --- INITIAL OFFLINE DATA ---
const INITIAL_OFFLINE_STOPS: BusStop[] = [];

export default function App() {
  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<"view" | "add" | "owner" | "about" | "settings" | "login" | "wishlist">("view");
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Sync active tab with URL hash on load
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (["view", "add", "owner", "about", "settings", "login", "wishlist"].includes(hash)) {
      setActiveTab(hash as any);
    }
  }, []);

  // Back dispatcher: Intercept back press event in Settings view
  // Override default finish behavior to trigger navigation to Home Board ("view") destination, preserving active tasks
  useEffect(() => {
    if (activeTab === "settings") {
      // Push history entry so back press event triggers popstate instead of finishing/exiting
      window.history.pushState({ view: "settings" }, "", "#settings");

      const handlePopState = (event: PopStateEvent) => {
        // Intercept back press event in Settings view
        event.preventDefault();
        // Override default finish behavior to navigate to Home Board ("view") destination, preserving active tasks
        setActiveTab("view");
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [activeTab]);

  // Starred / Favorite Stops state
  const [starredStops, setStarredStops] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("starred_stops");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("starred_stops", JSON.stringify(starredStops));
  }, [starredStops]);

  const toggleStar = (stopId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Avoid triggering details card click
    }
    setStarredStops(prev => {
      const exists = prev.includes(stopId);
      if (exists) {
        triggerToast("⭐ Removed from Wishlist");
        return prev.filter(id => id !== stopId);
      } else {
        triggerToast("⭐ Added to Wishlist");
        return [...prev, stopId];
      }
    });
  };
  
  // Language Switcher State ("en" = English, "ta" = Tamil)
  const [language, setLanguage] = useState<"en" | "ta">(() => {
    return (localStorage.getItem("app_lang") as "en" | "ta") || "en";
  });
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);

  const t = (key: keyof typeof TRANSLATIONS.en): string => {
    return TRANSLATIONS[language][key] || TRANSLATIONS.en[key];
  };

  const handleLanguageChange = (lang: "en" | "ta") => {
    setLanguage(lang);
    localStorage.setItem("app_lang", lang);
    triggerToast(lang === "ta" ? "👉 பயன்பாட்டு மொழி தமிழுக்கு மாற்றப்பட்டது!" : "👉 App language changed to English!");
  };
  
  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  
  // Responsive sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Switch Toggles State for Settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const cached = localStorage.getItem("settings_notifications");
    return cached !== "false"; // default true
  });

  const [offlineCachingEnabled, setOfflineCachingEnabled] = useState(() => {
    const cached = localStorage.getItem("settings_offline");
    return cached !== "false"; // default true
  });

  const toggleNotifications = () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem("settings_notifications", String(nextVal));
    triggerToast(nextVal ? "🔔 Notifications enabled!" : "🔕 Notifications disabled!");
  };

  const toggleOfflineCaching = () => {
    const nextVal = !offlineCachingEnabled;
    setOfflineCachingEnabled(nextVal);
    localStorage.setItem("settings_offline", String(nextVal));
    triggerToast(nextVal ? "💾 Offline caching active!" : "🚫 Offline caching inactive!");
  };

  // Stop List State
  const [stops, setStops] = useState<BusStop[]>([]);
  
  // Local Map State for Interactive Card centering/zooming
  const [mapCenterCoords, setMapCenterCoords] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(15);

  useEffect(() => {
    if (selectedStopId) {
      const item = stops.find(s => s.id === selectedStopId);
      if (item && item.gps) {
        setMapCenterCoords(item.gps);
        setMapZoom(15);
      }
    } else {
      setMapCenterCoords(null);
    }
  }, [selectedStopId, stops]);

  const [searchQuery, setSearchQuery] = useState("");
  
  // Add Stop Form State
  const [formData, setFormData] = useState({
    name: "",
    village: "",
    location: "",
    startRoute: "",
    endRoute: "",
    route: "Medium Crowd",
    timings: "",
    gps: "",
    activeDays: "All Days",
    excludedDays: ""
  });
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"none" | "pinned" | "error">("none");
  const [showToast, setShowToast] = useState("");
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);

  const [startSuggestions, setStartSuggestions] = useState<any[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<any[]>([]);
  const [isStartLoading, setIsStartLoading] = useState(false);
  const [isEndLoading, setIsEndLoading] = useState(false);

  const startSearchTimeoutRef = useRef<any>(null);
  const endSearchTimeoutRef = useRef<any>(null);

  // Dynamic route suggestions helper based on Tamil Nadu cities and user-defined records
  const getRouteSuggestions = (typedText: string, isStart: boolean) => {
    const DEFAULT_HUBS = [
      "Chennai", "Karur", "Trichy", "Coimbatore", "Madurai", "Salem", 
      "Erode", "Tiruppur", "Thanjavur", "Nagercoil", "Vellore", "Dindigul", 
      "Palani", "Pudukkottai", "Namakkal", "Kumbakonam", "Tuticorin"
    ];
    
    // Extract unique existing inputs from user database to dynamically populate
    const existingValues = Array.from(
      new Set(
        stops
          .map(s => isStart ? s.startRoute : s.endRoute)
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      )
    );

    // Combine both pools and deduplicate them perfectly
    const combinedPool = Array.from(new Set([...existingValues, ...DEFAULT_HUBS]));
    const query = (typedText || "").trim().toLowerCase();
    
    // If field is focused but empty, suggest top 5 popular hubs
    if (!query) {
      return combinedPool.slice(0, 5);
    }
    
    // Filter matching hubs
    return combinedPool.filter(h => h.toLowerCase().includes(query)).slice(0, 5);
  };

  // Autocomplete fetchers mirroring main map search bar for Start Route field
  useEffect(() => {
    const queryStr = formData.startRoute || "";
    const localSugs = getRouteSuggestions(queryStr, true).map(name => ({
      name,
      display_name: `${name} (Local Hub)`,
      sub: "Tamil Nadu Route Hub"
    }));
    
    setStartSuggestions(localSugs);

    if (queryStr.trim().length < 3) {
      setIsStartLoading(false);
      return;
    }

    if (startSearchTimeoutRef.current) {
      clearTimeout(startSearchTimeoutRef.current);
    }

    setIsStartLoading(true);
    startSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const [nominatimPromise, geminiPromise] = [
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr + ", India")}&limit=5`)
            .then(r => r.json())
            .catch(() => []),
          fetch(`/api/geocode?q=${encodeURIComponent(queryStr)}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        ];

        const [nominatimData, geminiData] = await Promise.all([nominatimPromise, geminiPromise]);
        const apiResults: any[] = [];

        if (geminiData && geminiData.name) {
          apiResults.push({
            name: geminiData.name,
            display_name: `✨ AI: ${geminiData.name}, ${geminiData.state || "India"}`,
            sub: "Extracted via Gemini AI Geocoder"
          });
        }

        if (nominatimData && Array.isArray(nominatimData)) {
          nominatimData.forEach((item: any) => {
            const disp = (item.display_name || "").toLowerCase();
            if (disp.includes("india")) {
              apiResults.push({
                name: item.name || item.display_name.split(",")[0],
                display_name: item.display_name,
                sub: "Location Coordinate Map"
              });
            }
          });
        }

        const combined = [...localSugs, ...apiResults];
        const unique = Array.from(
          (new (window as any).Map(combined.map(item => [item.display_name, item])) as any).values()
        ) as any[];

        setStartSuggestions(unique.slice(0, 8));
      } catch (err) {
        console.warn("Start autocomplete suggestion query failed:", err);
      } finally {
        setIsStartLoading(false);
      }
    }, 600);

    return () => {
      if (startSearchTimeoutRef.current) {
        clearTimeout(startSearchTimeoutRef.current);
      }
    };
  }, [formData.startRoute, stops]);

  // Autocomplete fetchers mirroring main map search bar for End Route field
  useEffect(() => {
    const queryStr = formData.endRoute || "";
    const localSugs = getRouteSuggestions(queryStr, false).map(name => ({
      name,
      display_name: `${name} (Local Hub)`,
      sub: "Tamil Nadu Route Hub"
    }));
    
    setEndSuggestions(localSugs);

    if (queryStr.trim().length < 3) {
      setIsEndLoading(false);
      return;
    }

    if (endSearchTimeoutRef.current) {
      clearTimeout(endSearchTimeoutRef.current);
    }

    setIsEndLoading(true);
    endSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const [nominatimPromise, geminiPromise] = [
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr + ", India")}&limit=5`)
            .then(r => r.json())
            .catch(() => []),
          fetch(`/api/geocode?q=${encodeURIComponent(queryStr)}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        ];

        const [nominatimData, geminiData] = await Promise.all([nominatimPromise, geminiPromise]);
        const apiResults: any[] = [];

        if (geminiData && geminiData.name) {
          apiResults.push({
            name: geminiData.name,
            display_name: `✨ AI: ${geminiData.name}, ${geminiData.state || "India"}`,
            sub: "Extracted via Gemini AI Geocoder"
          });
        }

        if (nominatimData && Array.isArray(nominatimData)) {
          nominatimData.forEach((item: any) => {
            const disp = (item.display_name || "").toLowerCase();
            if (disp.includes("india")) {
              apiResults.push({
                name: item.name || item.display_name.split(",")[0],
                display_name: item.display_name,
                sub: "Location Coordinate Map"
              });
            }
          });
        }

        const combined = [...localSugs, ...apiResults];
        const unique = Array.from(
          (new (window as any).Map(combined.map(item => [item.display_name, item])) as any).values()
        ) as any[];

        setEndSuggestions(unique.slice(0, 8));
      } catch (err) {
        console.warn("End autocomplete suggestion query failed:", err);
      } finally {
        setIsEndLoading(false);
      }
    }, 600);

    return () => {
      if (endSearchTimeoutRef.current) {
        clearTimeout(endSearchTimeoutRef.current);
      }
    };
  }, [formData.endRoute, stops]);

  // Map Interactive Modal Specs
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [lowAccuracyWarning, setLowAccuracyWarning] = useState<boolean>(false);
  const [gpsErrorDetails, setGpsErrorDetails] = useState<string | null>(null);
  const [tempLatLng, setTempLatLng] = useState<{ lat: number; lng: number } | null>({ lat: 10.7905, lng: 78.7047 });
  const [pinALatLng, setPinALatLng] = useState<{ lat: number; lng: number }>({ lat: 10.7905, lng: 78.7047 });
  const [pinBLatLng, setPinBLatLng] = useState<{ lat: number; lng: number }>({ lat: 10.9578, lng: 78.0764 });
  const [busStopLatLng, setBusStopLatLng] = useState<{ lat: number; lng: number }>({ lat: 10.8741, lng: 78.3905 });
  const [pinASet, setPinASet] = useState(false);
  const [pinBSet, setPinBSet] = useState(false);
  const [busPinSet, setBusPinSet] = useState(false);
  const [mapStep, setMapStep] = useState<1 | 2>(1);
  const [showStep1Instructions, setShowStep1Instructions] = useState(false);
  const [showBottomSheetInstructions, setShowBottomSheetInstructions] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(true);
  const [isStopPanelExpanded, setIsStopPanelExpanded] = useState(false);
  const [activePinSelector, setActivePinSelector] = useState<"A" | "B" | "BUS">("A");
  const [belongsToPin, setBelongsToPin] = useState<"A" | "B" | null>(null);
  const [pickerMapInstance, setPickerMapInstance] = useState<any>(null);
  const [pickerMarkerInstance, setPickerMarkerInstance] = useState<any>(null); // references marker A
  const [pickerMarkerBInstance, setPickerMarkerBInstance] = useState<any>(null);
  const [pickerMarkerBusInstance, setPickerMarkerBusInstance] = useState<any>(null);
  const [pickerPolylineInstance, setPickerPolylineInstance] = useState<any>(null);
  const [pinCStops, setPinCStops] = useState<{ 
    lat: number; 
    lng: number;
    busName?: string;
    departureTime?: string;
    crowdLevel?: 'Low' | 'Medium' | 'High';
  }[]>([]);
  const pinCStopsRef = useRef<any[]>([]);
  useEffect(() => {
    pinCStopsRef.current = pinCStops;
  }, [pinCStops]);
  const pinCMarkersRef = useRef<any[]>([]);

  const liveLocationMarkerRef = useRef<any>(null);
  const liveLocationAccuracyCircleRef = useRef<any>(null);
  const watchPositionIdRef = useRef<number | null>(null);
  const pollingIntervalIdRef = useRef<any>(null);
  const [isLiveTrackingActive, setIsLiveTrackingActive] = useState(false);
  const deviceHeadingRef = useRef<number | null>(null);
  const animatedPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const targetPosRef = useRef<{ lat: number, lng: number, accuracy: number } | null>(null);
  const animatedHeadingRef = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lowAccuracyTimerRef = useRef<any>(null);

  const handleDeviceOrientation = (event: any) => {
    let heading: number | null = null;
    if (event.webkitCompassHeading !== undefined) {
      heading = event.webkitCompassHeading;
    } else if (event.alpha !== null && event.alpha !== undefined) {
      heading = 360 - event.alpha;
    }
    if (heading !== null) {
      deviceHeadingRef.current = heading;
    }
  };

  // Smooth animation loop using requestAnimationFrame
  const startSmoothAnimationLoop = (L: any, mapInstance: any) => {
    if (animationFrameIdRef.current !== null) return;

    const animate = () => {
      // 1. Position interpolation (smooth lerp toward target)
      if (targetPosRef.current) {
        if (!animatedPosRef.current) {
          animatedPosRef.current = { lat: targetPosRef.current.lat, lng: targetPosRef.current.lng };
        } else {
          const latDiff = targetPosRef.current.lat - animatedPosRef.current.lat;
          const lngDiff = targetPosRef.current.lng - animatedPosRef.current.lng;
          
          if (Math.abs(latDiff) < 0.000001 && Math.abs(lngDiff) < 0.000001) {
            animatedPosRef.current = { lat: targetPosRef.current.lat, lng: targetPosRef.current.lng };
          } else {
            animatedPosRef.current.lat += latDiff * 0.15;
            animatedPosRef.current.lng += lngDiff * 0.15;
          }
        }
      }

      // 2. Heading interpolation (shortest circular angular path LERP)
      if (deviceHeadingRef.current !== null) {
        const target = deviceHeadingRef.current;
        if (animatedHeadingRef.current === null) {
          animatedHeadingRef.current = target;
        } else {
          let diff = target - animatedHeadingRef.current;
          while (diff < -180) diff += 360;
          while (diff > 180) diff -= 360;
          animatedHeadingRef.current = (animatedHeadingRef.current + diff * 0.18 + 360) % 360;
        }
      }

      // 3. Apply updates directly to leaflet layers
      if (animatedPosRef.current) {
        if (liveLocationMarkerRef.current) {
          liveLocationMarkerRef.current.setLatLng([animatedPosRef.current.lat, animatedPosRef.current.lng]);
        }
        if (liveLocationAccuracyCircleRef.current) {
          liveLocationAccuracyCircleRef.current.setLatLng([animatedPosRef.current.lat, animatedPosRef.current.lng]);
          if (targetPosRef.current) {
            liveLocationAccuracyCircleRef.current.setRadius(targetPosRef.current.accuracy);
          }
        }
      }

      // Smoothly rotate heading beam container DOM element directly for high performance
      if (liveLocationMarkerRef.current) {
        const markerElement = liveLocationMarkerRef.current.getElement();
        if (markerElement) {
          const beamElement = markerElement.querySelector(".live-heading-beam");
          if (beamElement) {
            if (animatedHeadingRef.current !== null) {
              beamElement.style.transform = `rotate(${animatedHeadingRef.current}deg)`;
              beamElement.style.display = "block";
            } else {
              beamElement.style.display = "none";
            }
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
  };

  const fetchAndSyncLocation = (isFirstCall = false) => {
    if (!navigator.geolocation) return;

    const L = (window as any).L;
    if (!L || !pickerMapInstance) return;

    const handleSuccess = async (position: any) => {
      const { latitude, longitude, accuracy } = position.coords;

      // Monitor Accuracy: check if accuracy is greater than 50 meters
      if (accuracy > 50) {
        setLowAccuracyWarning(true);
        if (lowAccuracyTimerRef.current !== null) {
          clearTimeout(lowAccuracyTimerRef.current);
        }
        lowAccuracyTimerRef.current = setTimeout(() => {
          setLowAccuracyWarning(false);
          lowAccuracyTimerRef.current = null;
        }, 5000);
      } else {
        if (lowAccuracyTimerRef.current !== null) {
          clearTimeout(lowAccuracyTimerRef.current);
          lowAccuracyTimerRef.current = null;
        }
        setLowAccuracyWarning(false);
      }

      // Set target position for interpolation/smooth movement
      targetPosRef.current = { lat: latitude, lng: longitude, accuracy: accuracy };

      // Initialize Leaflet layers if they don't exist
      if (!liveLocationMarkerRef.current) {
        const liveIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center" style="width: 24px; height: 24px;">
              <!-- Real-time Compass Direction Beam Cone -->
              <div class="live-heading-beam absolute" style="display: none; width: 160px; height: 160px; pointer-events: none; top: -68px; left: -68px; transform-origin: center;">
                <svg viewBox="0 0 100 100" class="w-full h-full text-blue-500 fill-current opacity-75">
                  <defs>
                    <radialGradient id="beam-gradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stop-color="rgba(59, 130, 246, 0.65)" />
                      <stop offset="55%" stop-color="rgba(59, 130, 246, 0.25)" />
                      <stop offset="100%" stop-color="rgba(59, 130, 246, 0)" />
                    </radialGradient>
                  </defs>
                  <path d="M 50 50 L 30 15.4 A 40 40 0 0 1 70 15.4 Z" fill="url(#beam-gradient)" />
                </svg>
              </div>
              <!-- Pulse circle wrapper -->
              <div class="absolute w-6 h-6 bg-blue-500 rounded-full animate-ping opacity-50" style="left: 0px; top: 0px;"></div>
              <!-- Center Core Solid Dot -->
              <div class="relative w-4.5 h-4.5 bg-blue-600 border-2 border-white rounded-full shadow-lg" style="margin: 2px;"></div>
            </div>
          `,
          className: "live-location-icon",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const newLiveMarker = L.marker([latitude, longitude], { icon: liveIcon })
          .addTo(pickerMapInstance)
          .bindTooltip(
            language === "ta" 
              ? `📍 நீங்கள் இங்கே இருக்கிறீர்கள்!` 
              : `📍 You Are Here!`, 
            { permanent: false, direction: "top" }
          );

        liveLocationMarkerRef.current = newLiveMarker;
      }

      if (!liveLocationAccuracyCircleRef.current) {
        const newAccuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: "#3b82f6",
          weight: 1,
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          interactive: false
        }).addTo(pickerMapInstance);

        liveLocationAccuracyCircleRef.current = newAccuracyCircle;
      }

      // Start rendering/smooth lerp loop
      startSmoothAnimationLoop(L, pickerMapInstance);

      // Centering view
      if (isFirstCall) {
        animatedPosRef.current = { lat: latitude, lng: longitude };
        pickerMapInstance.setView([latitude, longitude], 18);
        triggerToast(language === "ta" ? "🎯 உங்கள் நேரடி இருப்பிடம் கண்டறியப்பட்டது!" : "🎯 Live location found and centered!");
      }

      // Sync to backend database (Firebase Firestore)
      if (firebaseInitialized && db) {
        try {
          const currentUid = auth?.currentUser?.uid || userSession?.username || "anonymous_session";
          const currentEmail = auth?.currentUser?.email || userSession?.email || "anonymous";
          const currentName = auth?.currentUser?.displayName || userSession?.name || "Anonymous User";

          await setDoc(doc(db, "user_locations", currentUid), {
            userId: currentUid,
            latitude,
            longitude,
            accuracy,
            displayName: currentName,
            email: currentEmail,
            updatedAt: new Date().toISOString()
          });
          console.log("📍 Live coordinates successfully synced to Firestore user_locations");
        } catch (firebaseErr) {
          console.warn("⚠️ Firestore location sync error:", firebaseErr);
        }
      }
    };

    const handleError = (error: any) => {
      console.warn("GPS Location access error code:", error?.code, "message:", error?.message);
      
      // Stop the continuous polling interval to avoid endless loops and warning spikes!
      if (pollingIntervalIdRef.current !== null) {
        clearInterval(pollingIntervalIdRef.current);
        pollingIntervalIdRef.current = null;
      }
      setIsLiveTrackingActive(false);
      
      let errorTitle = "";
      let errorDesc = "";

      if (error.code === error.TIMEOUT) {
        if (language === "ta") {
          errorTitle = "⏱️ இருப்பிட அணுகல் காலாவதியானது!";
          errorDesc = "சாதனத்தின் ஜிபிஎஸ் இணைப்பு பெற கூடுதல் நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும், அல்லது வரைபடத்தில் நேரடியாகத் தட்டி கைமுறையாக தேர்வு செய்யவும்.";
        } else {
          errorTitle = "⏱️ Location Request Timed Out!";
          errorDesc = "The device took too long to resolve the location. Please try again, or you can simply tap/click anywhere on the map to pin coordinates manually!";
        }
      } else {
        if (language === "ta") {
          errorTitle = "⚠️ இருப்பிட அணுகல் தோல்வி!";
          errorDesc = "தயவுசெய்து பின்வருவனவற்றை சரிபார்க்கவும்:\n" +
                      "1. உங்கள் மொபைல்/கணினியில் GPS / இருப்பிட சேவை (Location Services) ஆன் செய்யப்பட்டுள்ளதா?\n" +
                      "2. பிரவுசரின் முகவரிப் பட்டியில் (Address bar) இந்தத் தளத்திற்கு இருப்பிட அனுமதி (Location Permission) வழங்கப்பட்டுள்ளதா?\n" +
                      "3. அல்லது வரைபடத்தில் நேரடியாகத் தட்டி கைமுறையாக தேர்வு செய்யவும்!";
        } else {
          errorTitle = "⚠️ Location Access Failed!";
          errorDesc = "Please verify the following:\n" +
                      "1. Is GPS / Location Services turned ON in your device/system settings?\n" +
                      "2. Have you granted 'Location Permission' to this website in your browser's address bar/permissions?\n" +
                      "3. You can also simply tap/click anywhere on the map to pin coordinates manually!";
        }
      }

      // Elegant state-based in-app overlay instead of crashing window.alert()!
      setGpsErrorDetails(`${errorTitle}\n\n${errorDesc}`);

      if (isFirstCall) {
        if (error.code === error.TIMEOUT) {
          triggerToast(language === "ta" ? "❌ இருப்பிடத் தேடல் காலாவதியானது!" : "❌ Location request timed out!");
        } else {
          triggerToast(language === "ta" ? "❌ இருப்பிட அனுமதி மறுக்கப்பட்டது!" : "❌ Location permission denied!");
        }
      }
    };

    // First, attempt high accuracy GPS tracking
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (highAccuracyError) => {
        console.log("High accuracy lock failed, trying standard cellular/Wi-Fi fallback...", highAccuracyError);
        
        // Immediate fallback to standard accuracy
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (standardAccuracyError) => {
            handleError(standardAccuracyError);
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000 // allow up to 1-minute old cached location for instant lookup
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000 // allow up to 10 seconds old cached location
      }
    );
  };

  const handleSeeWhereYouAre = () => {
    if (!navigator.geolocation) {
      triggerToast(language === "ta" ? "❌ உங்கள் உலாவி புவிஇருப்பிடத்தை ஆதரிக்கவில்லை!" : "❌ Geolocation is not supported by your browser!");
      return;
    }

    const L = (window as any).L;
    if (!L || !pickerMapInstance) {
      triggerToast(language === "ta" ? "❌ மேப் இன்னும் தயாராகவில்லை!" : "❌ Map is not ready yet!");
      return;
    }

    // Enable compass heading orientation listeners (handling iOS permissions if applicable)
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
            window.addEventListener("deviceorientation", handleDeviceOrientation, true);
          }
        })
        .catch((err: any) => console.log("Compass requestPermission error:", err));
    } else {
      window.addEventListener("deviceorientation", handleDeviceOrientation, true);
      window.addEventListener("deviceorientationabsolute", handleDeviceOrientation, true);
    }

    triggerToast(language === "ta" ? "🛰️ 10 நொடி இடைவெளியில் புவிஇருப்பிட கண்காணிப்பு தொடங்கப்பட்டது..." : "🛰️ Geolocation tracking started with 10-second intervals...");

    setIsLiveTrackingActive(true);

    // Stop any existing intervals
    if (pollingIntervalIdRef.current !== null) {
      clearInterval(pollingIntervalIdRef.current);
    }

    // Immediate initial lock (isFirstCall = true to center map)
    fetchAndSyncLocation(true);

    // Poll location exactly every 10 seconds (10000ms)
    pollingIntervalIdRef.current = setInterval(() => {
      fetchAndSyncLocation(false);
    }, 10000);
  };

  const handleManualLocationRefresh = () => {
    if (!navigator.geolocation) {
      triggerToast(language === "ta" ? "❌ உங்கள் உலாவி புவிஇருப்பிடத்தை ஆதரிக்கவில்லை!" : "❌ Geolocation is not supported by your browser!");
      return;
    }
    const L = (window as any).L;
    if (!L || !pickerMapInstance) {
      triggerToast(language === "ta" ? "❌ மேப் இன்னும் தயாராகவில்லை!" : "❌ Map is not ready yet!");
      return;
    }

    triggerToast(language === "ta" ? "🔄 தற்போதைய இருப்பிடம் புதுப்பிக்கப்படுகிறது..." : "🔄 Refreshing current location on-demand...");

    // Immediate update and center map
    fetchAndSyncLocation(true);

    // Reset the 10-second interval timer
    if (pollingIntervalIdRef.current !== null) {
      clearInterval(pollingIntervalIdRef.current);
    }
    pollingIntervalIdRef.current = setInterval(() => {
      fetchAndSyncLocation(false);
    }, 10000);

    setIsLiveTrackingActive(true);
  };

  const [activeStopPopupIdx, setActiveStopPopupIdx] = useState<number | null>(null);

  useEffect(() => {
    setActiveStopPopupIdx(null);
  }, [mapStep]);

  const syncStopsToRegistry = (updatedStops: any[]) => {
    // Collect non-empty bus names/numbers
    const busNames = updatedStops.map(s => s.busName?.trim()).filter(Boolean);
    const combinedBusNames = busNames.join(", ");

    // Collect departure times
    const times = updatedStops.map(s => s.departureTime?.trim()).filter(Boolean);
    const combinedTimes = times.join(", ");

    // Get last stop's crowd level or fall back to default
    const lastWithCrowd = [...updatedStops].reverse().find(s => s.crowdLevel);
    const lastCrowd = lastWithCrowd?.crowdLevel || "Medium";
    const combinedCrowd = `${lastCrowd} Crowd`;

    // Coordinates path representation
    const coordStr = updatedStops.map((p, i) => {
      let label = `Bus Stop ${i+1}: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
      if (p.busName) label += ` (${p.busName})`;
      if (p.departureTime) label += ` [Dep: ${p.departureTime}]`;
      return label;
    }).join(" | ");

    setFormData(prev => ({
      ...prev,
      location: combinedBusNames || "Local Bus Service",
      timings: combinedTimes || "Regular / Flexible Timings",
      route: combinedCrowd,
      gps: coordStr
    }));
    
    if (updatedStops.length > 0) {
      setGpsStatus("pinned");
    }
  };

  useEffect(() => {
    (window as any).toggleAmpmDropdown = (idx: number) => {
      const menu = document.getElementById(`popup_ampm_menu_${idx}`);
      if (menu) {
        menu.classList.toggle("hidden");
      }
    };

    (window as any).selectAmpm = (idx: number, opt: "AM" | "PM") => {
      const valSpan = document.getElementById(`popup_ampm_val_${idx}`);
      const menu = document.getElementById(`popup_ampm_menu_${idx}`);
      if (valSpan) {
        valSpan.innerText = opt;
      }
      if (menu) {
        menu.classList.add("hidden");
      }
    };

    (window as any).handlePopupHourInput = (event: any, idx: number) => {
      const input = event.target;
      let val = input.value.replace(/\D/g, "");
      if (val.length > 2) {
        val = val.slice(0, 2);
      }
      input.value = val;
      
      if (val.length === 2) {
        const minInput = document.getElementById(`popup_time_mm_${idx}`) as HTMLInputElement | null;
        if (minInput) {
          minInput.focus();
          minInput.select();
        }
      }
    };

    (window as any).validatePopupHour = (event: any, idx: number) => {
      const input = event.target;
      let val = input.value.replace(/\D/g, "");
      if (val) {
        let num = parseInt(val, 10);
        if (isNaN(num) || num < 1 || num > 12) {
          if (num < 1) num = 1;
          if (num > 12) num = 12;
          val = String(num).padStart(2, "0");
        } else {
          val = String(num).padStart(2, "0");
        }
      } else {
        val = "08";
      }
      input.value = val;
    };

    (window as any).handlePopupMinInput = (event: any, idx: number) => {
      const input = event.target;
      let val = input.value.replace(/\D/g, "");
      if (val.length > 2) {
        val = val.slice(0, 2);
      }
      input.value = val;
    };

    (window as any).validatePopupMin = (event: any, idx: number) => {
      const input = event.target;
      let val = input.value.replace(/\D/g, "");
      if (val) {
        let num = parseInt(val, 10);
        if (isNaN(num) || num < 0 || num > 59) {
          if (num < 0) num = 0;
          if (num > 59) num = 59;
          val = String(num).padStart(2, "0");
        } else {
          val = String(num).padStart(2, "0");
        }
      } else {
        val = "30";
      }
      input.value = val;
    };

    (window as any).savePopupInfo = (idx: number) => {
      const nameInput = document.getElementById(`popup_bus_name_${idx}`) as HTMLInputElement;
      const hhInput = document.getElementById(`popup_time_hh_${idx}`) as HTMLInputElement;
      const mmInput = document.getElementById(`popup_time_mm_${idx}`) as HTMLInputElement;
      const ampmSpan = document.getElementById(`popup_ampm_val_${idx}`);
      const crowdInput = document.getElementById(`popup_crowd_${idx}`) as HTMLSelectElement;

      if (nameInput && hhInput && mmInput && crowdInput) {
        const busName = nameInput.value;
        
        let hhNum = parseInt(hhInput.value.replace(/\D/g, ""), 10);
        if (isNaN(hhNum) || hhNum < 1 || hhNum > 12) {
          hhNum = 8;
        }
        let mmNum = parseInt(mmInput.value.replace(/\D/g, ""), 10);
        if (isNaN(mmNum) || mmNum < 0 || mmNum > 59) {
          mmNum = 30;
        }
        
        const hhStr = String(hhNum).padStart(2, "0");
        const mmStr = String(mmNum).padStart(2, "0");
        const ampmVal = ampmSpan ? ampmSpan.innerText : "AM";
        const departureTime = `${hhStr}:${mmStr} ${ampmVal.trim()}`;
        const crowdLevel = crowdInput.value as 'Low' | 'Medium' | 'High';

        setActiveStopPopupIdx(null);
        setPinCStops(prev => {
          const copy = [...prev];
          if (copy[idx]) {
            copy[idx] = {
              ...copy[idx],
              busName,
              departureTime,
              crowdLevel
            };
          }
          syncStopsToRegistry(copy);
          return copy;
        });

        triggerToast(`✅ Updated Bus Stop ${idx + 1} info!`);
        
        // Auto close popup
        if (pickerMapInstance) {
          pickerMapInstance.closePopup();
        }
      }
    };

    return () => {
      delete (window as any).toggleAmpmDropdown;
      delete (window as any).selectAmpm;
      delete (window as any).handlePopupHourInput;
      delete (window as any).validatePopupHour;
      delete (window as any).handlePopupMinInput;
      delete (window as any).validatePopupMin;
      delete (window as any).savePopupInfo;
    };
  }, [pickerMapInstance, setActiveStopPopupIdx]);

  const [waypointLatLng, setWaypointLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const waypointLatLngRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    waypointLatLngRef.current = waypointLatLng;
  }, [waypointLatLng]);

  const [pickerWaypointMarkerInstance, setPickerWaypointMarkerInstance] = useState<any>(null);
  const pickerWaypointMarkerRef = useRef<any>(null);
  const alternativePolylinesRef = useRef<any[]>([]);
  const lastValidWaypointLatLngRef = useRef<{ lat: number; lng: number } | null>(null);

  const snapToRoute = (latlng: { lat: number; lng: number }): { lat: number; lng: number } => {
    if (!pickerPolylineInstance) return latlng;
    try {
      const latLngs = pickerPolylineInstance.getLatLngs();
      if (!latLngs || latLngs.length === 0) return latlng;
      
      let pts: { lat: number; lng: number }[] = [];
      const extract = (arr: any) => {
        if (Array.isArray(arr)) {
          if (arr.length > 0) {
            if (typeof arr[0] === 'number') {
              pts.push({ lat: arr[0], lng: arr[1] });
            } else if (typeof arr[0].lat === 'number') {
              arr.forEach((item: any) => pts.push({ lat: item.lat, lng: item.lng }));
            } else {
              arr.forEach((item: any) => extract(item));
            }
          }
        } else if (arr && typeof arr.lat === 'number' && typeof arr.lng === 'number') {
          pts.push({ lat: arr.lat, lng: arr.lng });
        }
      };
      extract(latLngs);

      if (pts.length === 0) return latlng;
      if (pts.length === 1) return pts[0];

      let minDist = Infinity;
      let closestPoint = pts[0];

      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i];
        const B = pts[i + 1];

        const xA = A.lat;
        const yA = A.lng;
        const xB = B.lat;
        const yB = B.lng;
        const xP = latlng.lat;
        const yP = latlng.lng;

        const dx = xB - xA;
        const dy = yB - yA;

        if (dx === 0 && dy === 0) continue;

        const t = ((xP - xA) * dx + (yP - yA) * dy) / (dx * dx + dy * dy);
        const clampedT = Math.max(0, Math.min(1, t));

        const qLat = xA + clampedT * dx;
        const qLng = yA + clampedT * dy;

        const distSq = (xP - qLat) * (xP - qLat) + (yP - qLng) * (yP - qLng);
        if (distSq < minDist) {
          minDist = distSq;
          closestPoint = { lat: qLat, lng: qLng };
        }
      }

      return closestPoint;
    } catch (err) {
      console.warn("Failed to snap latlng to route:", err);
      return latlng;
    }
  };

  const [mapSearchText, setMapSearchText] = useState("");
  const [mapSearchSuggestions, setMapSearchSuggestions] = useState<any[]>([]);
  const [isSatelliteMode, setIsSatelliteMode] = useState(true);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // Filter helpers
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState("All");

  // Authentication State
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const canEditStops = !!userSession && (activeTab === "add" || activeTab === "owner");

  // Liked Stops State (Per-user tracking)
  const [likedStops, setLikedStops] = useState<string[]>(() => {
    try {
      const savedSess = localStorage.getItem("busStopSess_v1");
      if (savedSess) {
        const sess = JSON.parse(savedSess);
        const uKey = sess.email || sess.username;
        const saved = localStorage.getItem(`liked_stops_${uKey}`);
        if (saved) return JSON.parse(saved);
      }
      const general = localStorage.getItem("liked_stops");
      return general ? JSON.parse(general) : [];
    } catch (e) {
      return [];
    }
  });

  // Save liked stops whenever state or user session changes
  useEffect(() => {
    if (userSession) {
      const uKey = userSession.email || userSession.username;
      localStorage.setItem(`liked_stops_${uKey}`, JSON.stringify(likedStops));
    } else {
      localStorage.setItem("liked_stops", JSON.stringify(likedStops));
    }
  }, [likedStops, userSession]);

  // Load user specific liked stops when userSession changes
  useEffect(() => {
    if (userSession) {
      const uKey = userSession.email || userSession.username;
      try {
        const saved = localStorage.getItem(`liked_stops_${uKey}`);
        if (saved) {
          setLikedStops(JSON.parse(saved));
        } else {
          setLikedStops([]);
        }
      } catch (e) {
        setLikedStops([]);
      }
    } else {
      setLikedStops([]);
    }
  }, [userSession?.email, userSession?.username]);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password / Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Timing builder states for Add Stop form to prevent typos and ease input selection
  const [newHour, setNewHour] = useState("06");
  const [newMinute, setNewMinute] = useState("30");
  const [newAmPm, setNewAmPm] = useState("PM");

  const handleAddTimingPill = () => {
    // Only use precise hour, minute and AM/PM selectors. No typing required.
    const formatted = `${newHour}:${newMinute} ${newAmPm}`;

    // Parse current timings
    const currentList = formData.timings
      ? formData.timings.split(",").map(t => t.trim()).filter(Boolean)
      : [];
    
    if (currentList.includes(formatted)) {
      triggerToast("⚠️ This timing is already added!");
      return;
    }
    
    const updatedList = [...currentList, formatted];
    setFormData(prev => ({ ...prev, timings: updatedList.join(", ") }));
    triggerToast(`✨ Added Departure: ${formatted}`);
  };

  const handleRemoveTimingPill = (timingToRemove: string) => {
    const currentList = formData.timings
       ? formData.timings.split(",").map(t => t.trim()).filter(Boolean)
       : [];
    const updatedList = currentList.filter(t => t !== timingToRemove);
    setFormData(prev => ({ ...prev, timings: updatedList.join(", ") }));
  };

  // Firebase ready status flag for visual alerts
  const [usingFirebaseRealtime, setUsingFirebaseRealtime] = useState(false);

  // Toggle Like feature with Auth requirement, 1-vote constraint & toggle mechanism
  const toggleLike = async (stopId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Avoid triggering card navigation
    }

    // 1. Authentication Requirement: Redirect unauthenticated users to login
    if (!userSession) {
      triggerToast("🔐 Please login to like bus stops!");
      setActiveTab("login");
      return;
    }

    const isLiked = likedStops.includes(stopId);
    const targetStop = stops.find(s => s.id === stopId);
    const currentLikes = Math.max(0, targetStop?.likeCount ?? 0);

    if (!isLiked) {
      // LIKE ACTION (+1)
      const newLikeCount = currentLikes + 1;
      setLikedStops(prev => (prev.includes(stopId) ? prev : [...prev, stopId]));
      setStops(prevStops =>
        prevStops.map(s => (s.id === stopId ? { ...s, likeCount: newLikeCount } : s))
      );
      triggerToast("💛 Liked bus stop!");
      console.log("Bus Stop Liked:", stopId, "Total Likes:", newLikeCount);

      if (usingFirebaseRealtime && db && !stopId.startsWith("local-") && !stopId.startsWith("off-")) {
        try {
          if (auth && !auth.currentUser) {
            try {
              await signInAnonymously(auth);
            } catch (authErr) {
              console.warn("Anonymous auth before like update notice:", authErr);
            }
          }

          const docRef = doc(db, "bus_updates", stopId);
          await setDoc(docRef, {
            likeCount: increment(1)
          }, { merge: true }).catch((err) => {
            console.warn("Firestore like count update warning:", err?.message || err);
          });
        } catch (err) {
          console.warn("Like count update error:", err);
        }
      }
    } else {
      // UNLIKE ACTION (-1)
      const newLikeCount = Math.max(0, currentLikes - 1);
      setLikedStops(prev => prev.filter(id => id !== stopId));
      setStops(prevStops =>
        prevStops.map(s => (s.id === stopId ? { ...s, likeCount: newLikeCount } : s))
      );
      triggerToast("🤍 Removed like");
      console.log("Bus Stop Unliked:", stopId, "Total Likes:", newLikeCount);

      if (usingFirebaseRealtime && db && !stopId.startsWith("local-") && !stopId.startsWith("off-")) {
        try {
          if (auth && !auth.currentUser) {
            try {
              await signInAnonymously(auth);
            } catch (authErr) {
              console.warn("Anonymous auth before like update notice:", authErr);
            }
          }

          const docRef = doc(db, "bus_updates", stopId);
          await setDoc(docRef, {
            likeCount: increment(-1)
          }, { merge: true }).catch((err) => {
            console.warn("Firestore like count update warning:", err?.message || err);
          });
        } catch (err) {
          console.warn("Like count update error:", err);
        }
      }
    }
  };

  // --- REPORT & NOTIFICATION SYSTEM STATES ---
  const [reportingStop, setReportingStop] = useState<BusStop | null>(null);
  const [reportReason, setReportReason] = useState<string>("Bus was not going the route");
  const [reportDetails, setReportDetails] = useState<string>("");
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<BusReportNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);

  // Open Report Modal with Authentication Check
  const handleOpenReportModal = (stop: BusStop, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!userSession) {
      triggerToast("🔐 Please login to report bus stops!");
      setActiveTab("login");
      return;
    }
    setReportingStop(stop);
    setReportReason("Bus was not going the route");
    setReportDetails("");
  };

  // Helper function for flexible target owner / creator identification
  const isMatchingOwner = (ownerName: string | undefined, session: UserSession | null, stopIdOrDoc?: string | any): boolean => {
    if (!session) return false;

    const notifDoc = typeof stopIdOrDoc === "object" && stopIdOrDoc !== null ? stopIdOrDoc : null;
    const stopId = typeof stopIdOrDoc === "string" ? stopIdOrDoc : (notifDoc?.stopId || undefined);

    const sessionUid = (session.uid || session.id || "").toString().trim();
    const sessionEmail = (session.email || "").toLowerCase().trim();
    const sessionEmailUser = sessionEmail ? sessionEmail.split("@")[0] : "";

    const clean = (s: string | undefined | null) => String(s || "").replace(/^@/, "").replace(/\s+/g, "").toLowerCase().trim();
    const normOwner = clean(ownerName);
    const normName = clean(session.name);
    const normUser = clean(session.username);
    const normEmail = clean(session.email);
    const normEmailPrefix = clean(sessionEmailUser);

    // 1. Priority 1: Direct recipientId match
    if (notifDoc && notifDoc.recipientId && sessionUid && String(notifDoc.recipientId).trim() === sessionUid) {
      return true;
    }

    // 2. Priority 2: Direct recipientEmail match (or email prefix match)
    if (notifDoc && notifDoc.recipientEmail && sessionEmail) {
      const targetEmail = String(notifDoc.recipientEmail).toLowerCase().trim();
      const targetEmailPrefix = clean(targetEmail.split("@")[0]);
      if (targetEmail === sessionEmail || (targetEmailPrefix && (targetEmailPrefix === normName || targetEmailPrefix === normUser || targetEmailPrefix === normEmailPrefix))) {
        return true;
      }
    }

    // 3. Priority 3: Owner Name string comparison
    if (normOwner && normOwner !== "contributor" && normOwner !== "public" && normOwner !== "admin") {
      if (
        (normName && (normOwner === normName || normOwner.includes(normName) || normName.includes(normOwner))) ||
        (normUser && (normOwner === normUser || normOwner.includes(normUser) || normUser.includes(normOwner))) ||
        (normEmail && (normOwner === normEmail || normOwner.includes(normEmail) || normEmail.includes(normOwner))) ||
        (normEmailPrefix && (normOwner === normEmailPrefix || normOwner.includes(normEmailPrefix) || normEmailPrefix.includes(normOwner)))
      ) {
        return true;
      }
    }

    // 4. Priority 4: Look up target stop in stops list by stopId
    if (stopId && stops && stops.length > 0) {
      const targetStop = stops.find(s => s.id === stopId);
      if (targetStop) {
        const creatorId = (targetStop as any).creatorId;
        if (creatorId && sessionUid && String(creatorId).trim() === sessionUid) {
          return true;
        }
        const creatorEmail = (targetStop as any).creatorEmail;
        if (creatorEmail) {
          const cleanCreatorEmail = String(creatorEmail).toLowerCase().trim();
          const cleanCreatorPrefix = clean(cleanCreatorEmail.split("@")[0]);
          if (cleanCreatorEmail === sessionEmail || (cleanCreatorPrefix && (cleanCreatorPrefix === normName || cleanCreatorPrefix === normUser || cleanCreatorPrefix === normEmailPrefix))) {
            return true;
          }
        }
        if (targetStop.addedBy) {
          const normAddedBy = clean(targetStop.addedBy);
          if (normAddedBy && normAddedBy !== "contributor" && normAddedBy !== "public") {
            if (
              (normName && (normAddedBy === normName || normAddedBy.includes(normName) || normName.includes(normAddedBy))) ||
              (normUser && (normAddedBy === normUser || normAddedBy.includes(normUser) || normUser.includes(normAddedBy))) ||
              (normEmail && (normAddedBy === normEmail || normAddedBy.includes(normEmail) || normEmail.includes(normAddedBy))) ||
              (normEmailPrefix && (normAddedBy === normEmailPrefix || normAddedBy.includes(normEmailPrefix) || normEmailPrefix.includes(normAddedBy)))
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  // Real-time Notification Listener for Logged-In Creators
  useEffect(() => {
    if (!userSession) {
      setNotifications([]);
      return;
    }

    let unsubNotifications: (() => void) | undefined;
    let unsubReports: (() => void) | undefined;

    const processDocs = (docsArray: any[]) => {
      const list: BusReportNotification[] = [];
      docsArray.forEach((docSnap: any) => {
        const data = docSnap.data ? docSnap.data() : docSnap;
        const docId = docSnap.id || data.id || "notif-" + Math.random();
        const rawOwner = data.ownerName || data.contributor || "Contributor";

        if (isMatchingOwner(rawOwner, userSession, data)) {
          list.push({
            id: docId,
            stopId: data.stopId || "",
            stopName: data.stopName || "Bus Stop",
            busName: data.busName || "",
            ownerName: rawOwner,
            recipientId: data.recipientId || null,
            recipientEmail: data.recipientEmail || null,
            reportedBy: data.reportedBy || "Passenger",
            reason: data.reason || "Reported issue",
            details: data.details || "",
            timestamp: data.timestamp || new Date().toISOString(),
            read: Boolean(data.read)
          });
        }
      });

      // Deduplicate by ID
      const uniqueDict: Record<string, BusReportNotification> = {};
      list.forEach(item => {
        if (!uniqueDict[item.id]) {
          uniqueDict[item.id] = item;
        }
      });

      // Merge local storage offline reports if any matching this user
      try {
        const saved = localStorage.getItem("bus_notifications_v1");
        if (saved) {
          const parsed: BusReportNotification[] = JSON.parse(saved);
          parsed.forEach(localNotif => {
            if (isMatchingOwner(localNotif.ownerName, userSession, localNotif) && !uniqueDict[localNotif.id]) {
              uniqueDict[localNotif.id] = localNotif;
            }
          });
        }
      } catch (e) {}

      const finalList: BusReportNotification[] = Object.values(uniqueDict);
      // Sort newest first
      finalList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setNotifications(finalList);
    };

    const loadLocalNotifications = () => {
      try {
        const saved = localStorage.getItem("bus_notifications_v1");
        if (saved) {
          const parsed: BusReportNotification[] = JSON.parse(saved);
          const matched = parsed.filter(localNotif => isMatchingOwner(localNotif.ownerName, userSession, localNotif));
          matched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setNotifications(matched);
        }
      } catch (e) {
        console.warn("Local notifications read warning:", e);
      }
    };

    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      if ((e as StorageEvent).key === "bus_notifications_v1" || (e as CustomEvent).type === "bus_notif_update") {
        loadLocalNotifications();
      }
    };

    window.addEventListener("storage", handleStorageChange as EventListener);
    window.addEventListener("bus_notif_update", handleStorageChange as EventListener);

    if (db) {
      try {
        // Listen to bus_notifications collection directly (no index required)
        const colRef = collection(db, "bus_notifications");
        unsubNotifications = onSnapshot(colRef, (snapshot) => {
          processDocs(snapshot.docs);
        }, (err) => {
          console.warn("Notifications onSnapshot error (applying local fallback):", err);
          loadLocalNotifications();
        });

        // Backup listener on bus_reports
        try {
          const colReportsRef = collection(db, "bus_reports");
          unsubReports = onSnapshot(colReportsRef, (snapshot) => {
            processDocs(snapshot.docs);
          }, () => {
            loadLocalNotifications();
          });
        } catch (e) {}
      } catch (e) {
        console.warn("Error setting up notifications snapshot:", e);
        loadLocalNotifications();
      }
    } else {
      loadLocalNotifications();
    }

    return () => {
      window.removeEventListener("storage", handleStorageChange as EventListener);
      window.removeEventListener("bus_notif_update", handleStorageChange as EventListener);
      if (unsubNotifications) unsubNotifications();
      if (unsubReports) unsubReports();
    };
  }, [db, userSession?.name, userSession?.username, userSession?.email, userSession?.uid, userSession?.id, stops]);

  // Submit Report Handler
  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingStop) return;

    if (!userSession) {
      triggerToast("🔐 Please login to report bus stops!");
      setActiveTab("login");
      setReportingStop(null);
      return;
    }

    if (reportReason === "Others" && !reportDetails.trim()) {
      triggerToast("⚠️ Please specify details for 'Others'");
      return;
    }

    setIsSubmittingReport(true);

    const selectedReason = reportReason === "Others" ? "Others (Custom Report)" : reportReason;
    const targetOwner = reportingStop.addedBy || "Contributor";
    const stopDisplayName = reportingStop.village ? `${reportingStop.name} (${reportingStop.village})` : reportingStop.name;
    const busDisplayName = reportingStop.location || reportingStop.startRoute || reportingStop.name;

    const recipientId = (reportingStop as any).creatorId || (reportingStop as any).userId || (reportingStop as any).uid || null;
    const recipientEmail = (((reportingStop as any).creatorEmail || (reportingStop as any).email || "").toLowerCase().trim()) || null;

    const newNotif = {
      stopId: reportingStop.id || "",
      stopName: stopDisplayName,
      busName: busDisplayName,
      ownerName: targetOwner,
      recipientId: recipientId,
      recipientEmail: recipientEmail,
      reportedBy: userSession ? `${userSession.name} (@${userSession.username})` : "Anonymous Passenger",
      reason: selectedReason,
      details: reportDetails.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };

    try {
      if (db) {
        if (auth && !auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (aErr) {}
        }
        try {
          await addDoc(collection(db, "bus_notifications"), newNotif);
        } catch (fErr) {
          console.warn("Firestore bus_notifications write notice:", fErr);
        }
        await addDoc(collection(db, "bus_reports"), newNotif).catch(() => {});
      }

      // Local storage fallback list update
      const saved = localStorage.getItem("bus_notifications_v1");
      const existing: BusReportNotification[] = saved ? JSON.parse(saved) : [];
      const localEntry: BusReportNotification = {
        ...newNotif,
        id: "local-notif-" + Date.now()
      };
      localStorage.setItem("bus_notifications_v1", JSON.stringify([localEntry, ...existing]));
      try {
        window.dispatchEvent(new CustomEvent("bus_notif_update"));
      } catch (e) {}

      // Immediate state update for instant UI feedback if reporter is owner or testing
      if (isMatchingOwner(targetOwner, userSession, newNotif)) {
        setNotifications(prev => [localEntry, ...prev]);
      }

      triggerToast("🚩 Report was successfully completed!");
      setReportingStop(null);
      setReportReason("Bus was not going the route");
      setReportDetails("");
    } catch (err: any) {
      console.warn("Error submitting report to Firestore:", err);
      // Still write to local storage so user experience is smooth
      const saved = localStorage.getItem("bus_notifications_v1");
      const existing: BusReportNotification[] = saved ? JSON.parse(saved) : [];
      const localEntry: BusReportNotification = {
        ...newNotif,
        id: "local-notif-" + Date.now()
      };
      localStorage.setItem("bus_notifications_v1", JSON.stringify([localEntry, ...existing]));
      try {
        window.dispatchEvent(new CustomEvent("bus_notif_update"));
      } catch (e) {}
      if (isMatchingOwner(targetOwner, userSession, newNotif)) {
        setNotifications(prev => [localEntry, ...prev]);
      }
      triggerToast("🚩 Report was successfully completed!");
      setReportingStop(null);
      setReportReason("Bus was not going the route");
      setReportDetails("");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (usingFirebaseRealtime && db && !id.startsWith("local-")) {
      try {
        await updateDoc(doc(db, "bus_notifications", id), { read: true });
      } catch (err) {
        console.warn("Mark read error:", err);
      }
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (usingFirebaseRealtime && db && !id.startsWith("local-")) {
      try {
        await deleteDoc(doc(db, "bus_notifications", id));
      } catch (err) {
        console.warn("Delete notification error:", err);
      }
    }
    try {
      const saved = localStorage.getItem("bus_notifications_v1");
      if (saved) {
        const parsed: BusReportNotification[] = JSON.parse(saved);
        const updated = parsed.filter(n => n.id !== id);
        localStorage.setItem("bus_notifications_v1", JSON.stringify(updated));
      }
    } catch(e) {}
  };

  const clearAllNotifications = async () => {
    const idsToDelete = notifications.map(n => n.id);
    setNotifications([]);
    if (usingFirebaseRealtime && db) {
      for (const id of idsToDelete) {
        if (!id.startsWith("local-")) {
          deleteDoc(doc(db, "bus_notifications", id)).catch(() => {});
        }
      }
    }
    try {
      localStorage.setItem("bus_notifications_v1", JSON.stringify([]));
    } catch(e) {}
    triggerToast("🧹 Notifications cleared!");
  };

  // --- COMPONENT DID MOUNT & LOCAL CONFIG RESCUE ---
  useEffect(() => {
    // 1. Recover Theme
    const savedTheme = localStorage.getItem("busStopTheme");
    if (savedTheme === "light") {
      setTheme("light");
      document.documentElement.classList.add("light-mode");
    } else {
      setTheme("dark");
      document.documentElement.classList.remove("light-mode");
    }

    // 2. Recover User Session
    const savedSess = localStorage.getItem("busStopSess_v1");
    if (savedSess) {
      try {
        setUserSession(JSON.parse(savedSess));
      } catch (e) {
        localStorage.removeItem("busStopSess_v1");
      }
    }

    // 3. Initialize real-time sync with Google Firestore if possible
    if (firebaseInitialized && db) {
      try {
        const qStops = query(collection(db, "bus_updates"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(qStops, (snapshot) => {
          const remoteStops: BusStop[] = snapshot.docs.map(doc => {
            const data = doc.data() as Omit<BusStop, "id">;
            return {
              id: doc.id,
              ...data,
              likeCount: Math.max(0, data.likeCount ?? 0)
            };
          });
          
          // Update stops with real-time remote data from Firestore
          setStops(prevStops => {
            const remoteIds = new Set(remoteStops.map(s => s.id));
            const localOnly = prevStops.filter(p => (p.id.startsWith("local-") || p.id.startsWith("off-")) && !remoteIds.has(p.id));
            return [...remoteStops, ...localOnly];
          });
          setUsingFirebaseRealtime(true);
        }, (error) => {
          const code = (error as any)?.code;
          if (code === "unavailable" || (error as any)?.message?.includes("offline")) {
            console.warn("Firestore listener operating in offline mode:", error?.message || error);
          } else {
            handleFirestoreError(error, OperationType.GET, "bus_updates");
          }
        });

        // Setup real-time authentication listener
        if (auth) {
          onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser && !firebaseUser.isAnonymous) {
              const sess: UserSession = {
                uid: firebaseUser.uid,
                id: firebaseUser.uid,
                username: firebaseUser.email?.split("@")[0] || "user",
                name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Verified User",
                email: firebaseUser.email || "",
                photo: firebaseUser.photoURL,
                type: "firebase_live"
              };
              setUserSession(sess);
              localStorage.setItem("busStopSess_v1", JSON.stringify(sess));
            }
          });
        }

        return () => unsubscribe();
      } catch (e) {
        console.error("Firebase Snapshot registration failed", e);
      }
    }
  }, []);

  // Write local updates helper
  const handleStopsStateUpdate = (updatedList: BusStop[]) => {
    setStops(updatedList);
  };

  const activePinSelectorRef = useRef<"A" | "B" | "BUS">("A");
  useEffect(() => {
    activePinSelectorRef.current = activePinSelector;
  }, [activePinSelector]);

  const mapStepRef = useRef<1 | 2>(1);
  const searchTimeoutRef = useRef<any>(null);
  useEffect(() => {
    mapStepRef.current = mapStep;
  }, [mapStep]);

  const pinASetRef = useRef(false);
  useEffect(() => {
    pinASetRef.current = pinASet;
  }, [pinASet]);

  const pinBSetRef = useRef(false);
  useEffect(() => {
    pinBSetRef.current = pinBSet;
  }, [pinBSet]);

  // --- ROAD-BASED ROUTING USING OSRM ---
  const fetchOSRMRoute = async (
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    targetPolyline: any = null,
    waypoint: { lat: number; lng: number } | null | undefined = undefined,
    mapInstanceToUse: any = null
  ): Promise<boolean> => {
    const poly = targetPolyline || pickerPolylineInstance;
    const map = mapInstanceToUse || pickerMapInstance;
    if (!poly) return false;

    // Helper: Clear any existing alternative polylines
    const clearAlts = () => {
      if (alternativePolylinesRef.current && alternativePolylinesRef.current.length > 0) {
        alternativePolylinesRef.current.forEach((layer: any) => {
          if (map && map.hasLayer(layer)) {
            map.removeLayer(layer);
          }
        });
        alternativePolylinesRef.current = [];
      }
    };

    const activeWaypoint = waypoint !== undefined ? waypoint : waypointLatLngRef.current;

    setIsRouteLoading(true);
    try {
      let url = "";
      if (activeWaypoint) {
        url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${activeWaypoint.lng},${activeWaypoint.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
      } else {
        url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("OSRM routing request failed");
      }
      const data = await response.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        // Clear previous alternatives
        clearAlts();

        const primaryRoute = data.routes[0];
        const coordinates = primaryRoute.geometry.coordinates; // Array of [lng, lat]
        const latLngs = coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        
        poly.setLatLngs(latLngs);
        
        // Convert distance to km and duration to minutes
        const distKm = primaryRoute.distance / 1000;
        const durMin = primaryRoute.duration / 60;
        setRouteDistance(distKm);
        setRouteDuration(durMin);

        // Draw alternative routes if they exist
        const L = (window as any).L;
        if (L && map && data.routes.length > 1) {
          const altRoutes = data.routes.slice(1, 4); // up to 3 alternatives
          altRoutes.forEach((altRoute: any, idx: number) => {
            const altCoords = altRoute.geometry.coordinates;
            const altLatLngs = altCoords.map((coord: [number, number]) => [coord[1], coord[0]]);
            
            // Slate/gray colors for alternative routes
            const altPoly = L.polyline(altLatLngs, {
              color: idx === 0 ? "#71717a" : idx === 1 ? "#a1a1aa" : "#d4d4d8",
              weight: 4,
              opacity: 0.6,
              dashArray: "8, 8",
              interactive: true
            }).addTo(map);

            const altDistKm = altRoute.distance / 1000;
            const altDurMin = altRoute.duration / 60;
            
            altPoly.bindTooltip(`Alt Route ${idx + 1}: ${altDistKm.toFixed(2)} km (~${Math.round(altDurMin)} mins)`, {
              sticky: true,
              className: "font-semibold text-[10px] p-1.5 opacity-90 rounded bg-zinc-800 text-white border-none shadow-md z-[9999]"
            });

            // Swap alternative route to primary on click
            altPoly.on("click", (clickEvent: any) => {
              L.DomEvent.stopPropagation(clickEvent);
              poly.setLatLngs(altLatLngs);
              setRouteDistance(altDistKm);
              setRouteDuration(altDurMin);
              triggerToast(`🛣️ Swapped to Alternative Route ${idx + 1}!`);
            });

            alternativePolylinesRef.current.push(altPoly);
          });
        }

        return true;
      } else {
        // Fallback straight line
        poly.setLatLngs([[start.lat, start.lng], [end.lat, end.lng]]);
        setRouteDistance(null);
        setRouteDuration(null);
        return false;
      }
    } catch (error) {
      console.warn("OSRM routing service failed, falling back to straight-line polyline:", error);
      poly.setLatLngs([[start.lat, start.lng], [end.lat, end.lng]]);
      setRouteDistance(null);
      setRouteDuration(null);
      return false;
    } finally {
      setIsRouteLoading(false);
    }
  };

  // --- LEAFLET MAP PICKER DIRECT INITIALIZER ---
  useEffect(() => {
    if (mapModalOpen) {
      // Small timeout to guarantee DOM elements are properly fitted
      const timer = setTimeout(() => {
        const L = (window as any).L;
        if (!L) {
          console.warn("Leaflet object not found on window. Map loader ignored.");
          return;
        }

        // Clean container in case of dirty hot reload state
        const container = L.DomUtil.get("reactMapPicker");
        if (container != null) {
          (container as any)._leaflet_id = null;
        }

        try {
          // Centered around Pin A coordinate
          const mapInstance = L.map("reactMapPicker", {
            zoomControl: false, // Disable default to prevent search bar overlap
            scrollWheelZoom: true,
            minZoom: 4,
            maxZoom: 22
          }).setView([pinALatLng.lat, pinALatLng.lng], 10);

          const tileUrl = isSatelliteMode 
            ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" 
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
          const tileAttr = isSatelliteMode 
            ? "&copy; Google Satellite Imagery" 
            : "&copy; OpenStreetMap contributors";

          L.tileLayer(tileUrl, {
            attribution: tileAttr,
            maxZoom: 22,
            maxNativeZoom: isSatelliteMode ? 19 : 18
          }).addTo(mapInstance);

          // Beautiful custom HTML markup icons for A and B with close button
          const iconA = L.divIcon({
            html: `
              <div class="relative w-11 h-11" style="overflow: visible;">
                <div class="w-11 h-11 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white font-black shadow-lg text-[9px] leading-none uppercase select-none">
                  Start
                </div>
                ${canEditStops ? `
                <div 
                  class="close-marker-btn absolute -top-1.5 -right-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-black shadow-md border border-white transition-all cursor-pointer text-center z-[9999]" 
                  style="width: 18px; height: 18px; font-size: 8px; font-weight: 900; line-height: 16px; font-family: sans-serif; display: flex; align-items: center; justify-content: center;"
                  title="Clear Start Location"
                >
                  ✕
                </div>
                ` : ""}
              </div>
            `,
            className: "custom-div-icon",
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });

          const iconB = L.divIcon({
            html: `
              <div class="relative w-11 h-11" style="overflow: visible;">
                <div class="w-11 h-11 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-black font-black shadow-lg text-[9px] leading-none uppercase select-none">
                  End
                </div>
                ${canEditStops ? `
                <div 
                  class="close-marker-btn absolute -top-1.5 -right-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-black shadow-md border border-white transition-all cursor-pointer text-center z-[9999]" 
                  style="width: 18px; height: 18px; font-size: 8px; font-weight: 900; line-height: 16px; font-family: sans-serif; display: flex; align-items: center; justify-content: center;"
                  title="Clear End Location"
                >
                  ✕
                </div>
                ` : ""}
              </div>
            `,
            className: "custom-div-icon",
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });

          const markerA = L.marker([pinALatLng.lat, pinALatLng.lng], {
            draggable: canEditStops,
            icon: iconA
          }).bindTooltip("📍 Start Location", { permanent: false });

          const markerB = L.marker([pinBLatLng.lat, pinBLatLng.lng], {
            draggable: canEditStops,
            icon: iconB
          }).bindTooltip("📍 End Location", { permanent: false });

          // Connecting Polyline styled like a modern driving route
          const polyInstance = L.polyline([[pinALatLng.lat, pinALatLng.lng], [pinBLatLng.lat, pinBLatLng.lng]], {
            color: "#3b82f6", // Vibrant modern blue for streets
            weight: 12, // Professional route line density - slightly wider for easier clicking
            opacity: 0.85,
            interactive: true
          });

          // Bind click helper directly & strictly on the route polyline component
          polyInstance.on("click", (e: any) => {
            if (e.originalEvent) {
              e.originalEvent.stopPropagation();
            }

            if (!canEditStops) return;

            if (mapStepRef.current === 2) {
              const clickPos = e.latlng;
              let snappedMaybe = { lat: clickPos.lat, lng: clickPos.lng };
              try {
                const latLngs = polyInstance.getLatLngs();
                if (latLngs && latLngs.length > 0) {
                  let pts: { lat: number; lng: number }[] = [];
                  const extract = (arr: any) => {
                    if (Array.isArray(arr)) {
                      if (arr.length > 0) {
                        if (typeof arr[0] === 'number') {
                          pts.push({ lat: arr[0], lng: arr[1] });
                        } else if (typeof arr[0].lat === 'number') {
                          arr.forEach((item: any) => pts.push({ lat: item.lat, lng: item.lng }));
                        } else {
                          arr.forEach((item: any) => extract(item));
                        }
                      }
                    } else if (arr && typeof arr.lat === 'number' && typeof arr.lng === 'number') {
                      pts.push({ lat: arr.lat, lng: arr.lng });
                    }
                  };
                  extract(latLngs);

                  if (pts.length > 0) {
                    let minDist = Infinity;
                    let closestPoint = pts[0];

                    for (let i = 0; i < pts.length - 1; i++) {
                      const A = pts[i];
                      const B = pts[i + 1];

                      const xA = A.lat;
                      const yA = A.lng;
                      const xB = B.lat;
                      const yB = B.lng;
                      const xP = clickPos.lat;
                      const yP = clickPos.lng;

                      const dx = xB - xA;
                      const dy = yB - yA;

                      if (dx === 0 && dy === 0) continue;

                      const t = ((xP - xA) * dx + (yP - yA) * dy) / (dx * dx + dy * dy);
                      const clampedT = Math.max(0, Math.min(1, t));

                      const qLat = xA + clampedT * dx;
                      const qLng = yA + clampedT * dy;

                      const distSq = (xP - qLat) * (xP - qLat) + (yP - qLng) * (yP - qLng);
                      if (distSq < minDist) {
                        minDist = distSq;
                        closestPoint = { lat: qLat, lng: qLng };
                      }
                    }
                    snappedMaybe = closestPoint;
                  }
                }
              } catch (err) {
                console.warn("Snapping failed on click:", err);
              }

              const newStopCoords = snappedMaybe;
              setPinCStops(prev => {
                const next = [...prev, newStopCoords];
                triggerToast(`🔴 Placed Bus Stop ${next.length}!`);
                setActiveStopPopupIdx(next.length - 1);
                syncStopsToRegistry(next);
                return next;
              });
              setBusStopLatLng(newStopCoords);
              setBusPinSet(true);
            }
          });

          // Add only if they are actually set!
          if (pinASetRef.current) {
            markerA.addTo(mapInstance);
          }
          if (pinBSetRef.current) {
            markerB.addTo(mapInstance);
          }
          if (pinASetRef.current && pinBSetRef.current) {
            polyInstance.addTo(mapInstance);
            fetchOSRMRoute(pinALatLng, pinBLatLng, polyInstance, undefined, mapInstance);
          }

          // Setup direct click handling for marker click to check if the close button was clicked!
          markerA.on("click", (e: any) => {
            if (!canEditStops) return;
            const target = e.originalEvent?.target;
            if (target && (target.classList.contains("close-marker-btn") || target.innerText === "✕")) {
              e.originalEvent.stopPropagation();
              if (mapStepRef.current === 1) {
                if (typeof (window as any).clearPinA === "function") {
                  (window as any).clearPinA();
                }
              }
            }
          });

          markerB.on("click", (e: any) => {
            if (!canEditStops) return;
            const target = e.originalEvent?.target;
            if (target && (target.classList.contains("close-marker-btn") || target.innerText === "✕")) {
              e.originalEvent.stopPropagation();
              if (mapStepRef.current === 1) {
                if (typeof (window as any).clearPinB === "function") {
                  (window as any).clearPinB();
                }
              }
            }
          });

          // Synchronization helpers for fluid drag experiences
          const syncPositionsDrag = () => {
            if (!canEditStops) return;
            const pA = markerA.getLatLng();
            const pB = markerB.getLatLng();
            if (pinASetRef.current && pinBSetRef.current) {
              polyInstance.setLatLngs([pA, pB]); // Draw quick straight line during active drag
            }
            setPinALatLng({ lat: pA.lat, lng: pA.lng });
            setPinBLatLng({ lat: pB.lat, lng: pB.lng });
          };

          const syncPositionsDragEnd = () => {
            if (!canEditStops) return;
            const pA = markerA.getLatLng();
            const pB = markerB.getLatLng();
            setPinALatLng({ lat: pA.lat, lng: pA.lng });
            setPinBLatLng({ lat: pB.lat, lng: pB.lng });
            setPinASet(true);
            setPinBSet(true);
            fetchOSRMRoute(pA, pB, polyInstance, undefined, mapInstance); // Calculate actual road-based route on drag release!
          };

          markerA.on("drag", syncPositionsDrag);
          markerA.on("dragend", syncPositionsDragEnd);
          markerB.on("drag", syncPositionsDrag);
          markerB.on("dragend", syncPositionsDragEnd);

          mapInstance.on("click", (e: any) => {
            if (!canEditStops) return;
            const clickPos = e.latlng;
            
            if (mapStepRef.current === 1) {
              if (!pinASetRef.current) {
                // First click drops a 'Start' pin
                markerA.setLatLng(clickPos);
                setPinALatLng({ lat: clickPos.lat, lng: clickPos.lng });
                setPinASet(true);
                setActivePinSelector("B");
                triggerToast("🔵 Start Location set! Now click on the map to place End Location.");
              } else if (!pinBSetRef.current) {
                // Second click drops an 'End' pin
                markerB.setLatLng(clickPos);
                setPinBLatLng({ lat: clickPos.lat, lng: clickPos.lng });
                setPinBSet(true);
                triggerToast("🟡 End Location set! Actual road-based route is calculating...");
              } else {
                if (activePinSelectorRef.current === "A") {
                  markerA.setLatLng(clickPos);
                  setPinALatLng({ lat: clickPos.lat, lng: clickPos.lng });
                  setPinASet(true);
                } else {
                  markerB.setLatLng(clickPos);
                  setPinBLatLng({ lat: clickPos.lat, lng: clickPos.lng });
                  setPinBSet(true);
                }
              }

              // Re-fetch road route starting from updated positions
              setTimeout(() => {
                if (pinASetRef.current && pinBSetRef.current) {
                  const pA = markerA.getLatLng();
                  const pB = markerB.getLatLng();
                  fetchOSRMRoute(pA, pB, polyInstance);
                }
              }, 50);
            }
          });

          setPickerMapInstance(mapInstance);
          setPickerMarkerInstance(markerA);
          setPickerMarkerBInstance(markerB);
          setPickerPolylineInstance(polyInstance);

          // Trigger invalidateSize to draw grids properly inside dynamic model viewport
          setTimeout(() => {
            mapInstance.invalidateSize();
          }, 350);

        } catch (err) {
          console.error("Leaflet initialization error:", err);
        }
      }, 100);

      return () => clearTimeout(timer);
    } else {
      // Destroy instances when modal is hidden
      if (liveLocationMarkerRef.current) {
        liveLocationMarkerRef.current.remove();
        liveLocationMarkerRef.current = null;
      }
      if (liveLocationAccuracyCircleRef.current) {
        liveLocationAccuracyCircleRef.current.remove();
        liveLocationAccuracyCircleRef.current = null;
      }
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      if (pollingIntervalIdRef.current !== null) {
        clearInterval(pollingIntervalIdRef.current);
        pollingIntervalIdRef.current = null;
      }
      setIsLiveTrackingActive(false);
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
      window.removeEventListener("deviceorientationabsolute", handleDeviceOrientation, true);

      // Reset values
      animatedPosRef.current = null;
      targetPosRef.current = null;
      animatedHeadingRef.current = null;
      deviceHeadingRef.current = null;
      if (lowAccuracyTimerRef.current !== null) {
        clearTimeout(lowAccuracyTimerRef.current);
        lowAccuracyTimerRef.current = null;
      }
      setLowAccuracyWarning(false);

      if (pickerMarkerBusRef.current) {
        pickerMarkerBusRef.current.remove();
        pickerMarkerBusRef.current = null;
      }
      if (pickerWaypointMarkerInstance) {
        pickerWaypointMarkerInstance.remove();
      }
      setPickerMapInstance(null);
      setPickerMarkerInstance(null);
      setPickerMarkerBInstance(null);
      setPickerMarkerBusInstance(null);
      setPickerPolylineInstance(null);
      setPickerWaypointMarkerInstance(null);
      setWaypointLatLng(null);
      lastValidWaypointLatLngRef.current = null;
      setPinCStops([]);

      // Clear any Pin C markers
      pinCMarkersRef.current.forEach((marker: any) => {
        marker.remove();
      });
      pinCMarkersRef.current = [];

      // Clear any alternative polylines
      if (alternativePolylinesRef.current && alternativePolylinesRef.current.length > 0) {
        alternativePolylinesRef.current.forEach((layer: any) => {
          layer.remove();
        });
        alternativePolylinesRef.current = [];
      }
    }
  }, [mapModalOpen]);

  // Global unmount cleanup for real-time geolocation tracking and device orientation
  useEffect(() => {
    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
      }
      if (pollingIntervalIdRef.current !== null) {
        clearInterval(pollingIntervalIdRef.current);
      }
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (lowAccuracyTimerRef.current !== null) {
        clearTimeout(lowAccuracyTimerRef.current);
      }
      window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
      window.removeEventListener("deviceorientationabsolute", handleDeviceOrientation, true);
    };
  }, []);

  // Dynamically update Start and End icons to hide or show close mark '✕' based on mapStep and canEditStops
  useEffect(() => {
    if (pickerMarkerInstance && pickerMarkerBInstance) {
      const L = (window as any).L;
      if (!L) return;

      const iconA = L.divIcon({
        html: `
          <div class="relative w-11 h-11" style="overflow: visible;">
            <div class="w-11 h-11 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white font-black shadow-lg text-[9px] leading-none uppercase select-none">
              Start
            </div>
            ${canEditStops && mapStep === 1 ? `
            <div 
              class="close-marker-btn absolute -top-1.5 -right-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-black shadow-md border border-white transition-all cursor-pointer text-center z-[9999]" 
              style="width: 18px; height: 18px; font-size: 8px; font-weight: 900; line-height: 16px; font-family: sans-serif; display: flex; align-items: center; justify-content: center;"
              title="Clear Start Location"
            >
              ✕
            </div>
            ` : ""}
          </div>
        `,
        className: "custom-div-icon",
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const iconB = L.divIcon({
        html: `
          <div class="relative w-11 h-11" style="overflow: visible;">
            <div class="w-11 h-11 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-black font-black shadow-lg text-[9px] leading-none uppercase select-none">
              End
            </div>
            ${canEditStops && mapStep === 1 ? `
            <div 
              class="close-marker-btn absolute -top-1.5 -right-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-black shadow-md border border-white transition-all cursor-pointer text-center z-[9999]" 
              style="width: 18px; height: 18px; font-size: 8px; font-weight: 900; line-height: 16px; font-family: sans-serif; display: flex; align-items: center; justify-content: center;"
              title="Clear End Location"
            >
              ✕
            </div>
            ` : ""}
          </div>
        `,
        className: "custom-div-icon",
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      pickerMarkerInstance.setIcon(iconA);
      pickerMarkerBInstance.setIcon(iconB);
    }
  }, [mapStep, pickerMarkerInstance, pickerMarkerBInstance, canEditStops]);

  const pickerMarkerBusRef = useRef<any>(null);

  // Maintain Pin C markers in a separate effect
  useEffect(() => {
    if (pickerMapInstance && mapStep === 2) {
      const L = (window as any).L;
      if (!L) return;

      // 1. Clear previous Pin C markers
      pinCMarkersRef.current.forEach((marker: any) => {
        if (pickerMapInstance.hasLayer(marker)) {
          pickerMapInstance.removeLayer(marker);
        }
      });
      pinCMarkersRef.current = [];

      // 2. Add a Pin C marker for each coordinate
      pinCStops.forEach((coord, idx) => {
        const iconBus = L.divIcon({
          html: `
            <div class="relative w-12 h-12" style="overflow: visible;">
              <div class="w-12 h-12 rounded-full bg-red-600 border-2 border-white flex flex-col items-center justify-center text-white font-black shadow-2xl text-[9px] animate-bounce leading-none gap-0.5 hover:scale-105 active:scale-95 transition-all" style="pointer-events: none;">
                <span class="text-xs" style="pointer-events: none;">🔴</span>
                <span class="font-black italic tracking-tight text-[6.5px] whitespace-nowrap" style="pointer-events: none;">BUS STOP ${idx + 1}</span>
              </div>
              <div 
                class="delete-pin-c-btn absolute -top-2 -right-2 rounded-full bg-zinc-900 border border-white hover:bg-zinc-700 text-white flex items-center justify-center font-extrabold shadow-md transition-all cursor-pointer text-center ${canEditStops ? '' : 'hidden'}" 
                style="width: 20px; height: 20px; font-size: 10px; font-weight: 900; line-height: 18px; font-family: sans-serif; display: ${canEditStops ? 'flex' : 'none'} !important; align-items: center; justify-content: center; z-index: 999999 !important; pointer-events: auto !important;"
                title="Remove Stop"
              >
                ✕
              </div>
            </div>
          `,
          className: `custom-div-icon-bus-${idx}`,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });

        const busMarker = L.marker([coord.lat, coord.lng], {
          draggable: canEditStops,
          icon: iconBus
        }).addTo(pickerMapInstance);

        const busName = coord.busName || "";
        const departureTime = coord.departureTime || "";
        const crowdLevel = coord.crowdLevel || "Medium";

        // Parse timeValOnly and ampmVal from stored departureTime
        let timeValOnly = "08:30";
        let ampmVal = "AM";
        if (departureTime) {
          const match = departureTime.trim().match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
          if (match) {
            timeValOnly = match[1];
            ampmVal = match[2].toUpperCase();
          } else {
            const standardMatch = departureTime.trim().match(/^(\d{2}):(\d{2})$/);
            if (standardMatch) {
              let hh = parseInt(standardMatch[1], 10);
              let mm = standardMatch[2];
              ampmVal = hh >= 12 ? "PM" : "AM";
              hh = hh % 12;
              if (hh === 0) hh = 12;
              timeValOnly = `${String(hh).padStart(2, '0')}:${mm}`;
            } else {
              timeValOnly = departureTime;
            }
          }
        }

        let hhVal = "08";
        let mmVal = "30";
        if (timeValOnly) {
          const parts = timeValOnly.split(":");
          if (parts.length === 2) {
            hhVal = parts[0].padStart(2, "0");
            mmVal = parts[1].padStart(2, "0");
          }
        }

        const popupHTML = !canEditStops ? `
          <div class="p-3 select-none space-y-2 text-neutral-200 font-sans" style="min-width: 220px; font-family: system-ui, -apple-system, sans-serif;">
            <div class="flex items-center justify-between border-b border-zinc-850 pb-1.5 mb-2">
              <span class="text-xs font-black text-[#f8be43] uppercase tracking-wider">🚍 Bus Stop Info</span>
              <span class="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-bold">Stop #${idx + 1}</span>
            </div>
            <div class="space-y-1">
              <span class="block text-[9px] uppercase font-bold tracking-wider text-neutral-500">Bus Name / Number</span>
              <span class="text-xs font-extrabold text-white">${busName || "Scheduled Stop"}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span class="block text-[9px] uppercase font-bold tracking-wider text-neutral-500">Departure</span>
                <span class="text-xs font-extrabold text-[#f8be43]">${departureTime || "Not Scheduled"}</span>
              </div>
              <div>
                <span class="block text-[9px] uppercase font-bold tracking-wider text-neutral-500">Crowd Level</span>
                <span class="text-xs font-extrabold ${crowdLevel === 'High' ? 'text-red-400' : crowdLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}">
                  ● ${crowdLevel || "Medium"}
                </span>
              </div>
            </div>
          </div>
        ` : `
          <div class="p-3 select-none space-y-2.5 text-neutral-200" style="min-width: 230px; font-family: system-ui, -apple-system, sans-serif; overflow: visible;">
            <div class="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2">
              <span class="text-xs font-black text-[#f0a500] uppercase tracking-wider">🚍 Edit Bus Stop ${idx + 1}</span>
            </div>
            
            <div class="space-y-1">
              <label class="block text-[10px] uppercase font-black tracking-wider text-neutral-400">Bus Name / Number</label>
              <input 
                type="text" 
                id="popup_bus_name_${idx}" 
                class="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" 
                placeholder="e.g. 5A, Fast Passenger" 
                value="${busName.replace(/"/g, '&quot;')}" 
              />
            </div>

            <div class="space-y-1" style="overflow: visible;">
              <label class="block text-[10px] uppercase font-black tracking-wider text-neutral-400">Departure Time</label>
              <div class="flex items-center gap-2" style="overflow: visible;">
                <div class="flex items-center gap-1.5 flex-1 min-w-0" style="overflow: visible;">
                  <input 
                    type="text" 
                    id="popup_time_hh_${idx}" 
                    maxlength="2"
                    pattern="[0-9]*"
                    inputmode="numeric"
                    class="w-12 text-center px-1.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent select-all" 
                    placeholder="HH" 
                    value="${hhVal.replace(/"/g, '&quot;')}" 
                    oninput="window.handlePopupHourInput(event, ${idx})"
                    onblur="window.validatePopupHour(event, ${idx})"
                  />
                  <span class="text-neutral-400 font-bold select-none">:</span>
                  <input 
                    type="text" 
                    id="popup_time_mm_${idx}" 
                    maxlength="2"
                    pattern="[0-9]*"
                    inputmode="numeric"
                    class="w-12 text-center px-1.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent select-all" 
                    placeholder="MM" 
                    value="${mmVal.replace(/"/g, '&quot;')}" 
                    oninput="window.handlePopupMinInput(event, ${idx})"
                    onblur="window.validatePopupMin(event, ${idx})"
                  />
                </div>
                
                <!-- Custom AM/PM Dropdown Toggle -->
                <div class="relative shrink-0 text-left" style="overflow: visible;">
                  <button 
                    type="button" 
                    id="popup_ampm_btn_${idx}"
                    onclick="window.toggleAmpmDropdown(${idx})"
                    class="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-white hover:bg-zinc-800 transition-colors focus:outline-none flex items-center gap-1.5 cursor-pointer"
                  >
                    <span id="popup_ampm_val_${idx}">${ampmVal}</span>
                    <span class="text-neutral-400 text-[9px] font-black">^</span>
                  </button>
                  
                  <div 
                    id="popup_ampm_menu_${idx}" 
                    class="hidden absolute right-0 mt-1 w-20 rounded-md shadow-2xl bg-zinc-800 border border-zinc-700 focus:outline-none"
                    style="z-index: 1000002 !important;"
                  >
                    <div class="py-1">
                      <button
                        type="button"
                        onclick="window.selectAmpm(${idx}, 'AM')"
                        class="w-full text-left text-neutral-200 block px-3 py-1.5 text-xs font-bold hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer"
                        style="background: transparent; border: none;"
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onclick="window.selectAmpm(${idx}, 'PM')"
                        class="w-full text-left text-neutral-200 block px-3 py-1.5 text-xs font-bold hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer"
                        style="background: transparent; border: none;"
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] uppercase font-black tracking-wider text-neutral-300">Crowd Level</label>
              <select 
                id="popup_crowd_${idx}" 
                class="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="Low" ${crowdLevel === 'Low' ? 'selected' : ''}>Low Crowd</option>
                <option value="Medium" ${crowdLevel === 'Medium' ? 'selected' : ''}>Medium Crowd</option>
                <option value="High" ${crowdLevel === 'High' ? 'selected' : ''}>High Crowd</option>
              </select>
            </div>

            <button 
              type="button" 
              onclick="window.savePopupInfo(${idx})" 
              class="w-full mt-2.5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-95 text-white font-extrabold text-[10.5px] rounded-lg shadow-lg hover:shadow-red-950/20 uppercase tracking-widest transition-all cursor-pointer text-center flex items-center justify-center gap-1 border border-red-500/20"
            >
              ✓ Done/Save Stop
            </button>
          </div>
        `;

        busMarker.bindPopup(popupHTML, {
          closeButton: true,
          autoClose: false,
          closeOnEscapeKey: true,
          className: "custom-bus-popup"
        });

        busMarker.on("popupopen", () => {
          setActiveStopPopupIdx(idx);
        });

        busMarker.on("drag", (dragEvent: any) => {
          if (!canEditStops) return;
          const pos = dragEvent.target.getLatLng();
          const snapped = snapToRoute({ lat: pos.lat, lng: pos.lng });
          busMarker.setLatLng([snapped.lat, snapped.lng]);

          const updated = [...pinCStopsRef.current];
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], ...snapped };
            pinCStopsRef.current = updated;
            if (idx === 0) {
              setBusStopLatLng(snapped);
            }
          }
        });

        busMarker.on("dragend", (dragEvent: any) => {
          if (!canEditStops) return;
          const pos = dragEvent.target.getLatLng();
          const snapped = snapToRoute({ lat: pos.lat, lng: pos.lng });
          busMarker.setLatLng([snapped.lat, snapped.lng]);

          const updated = [...pinCStopsRef.current];
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], ...snapped };
            setPinCStops(updated);
            syncStopsToRegistry(updated);
            if (idx === 0) {
              setBusStopLatLng(snapped);
            }
            triggerToast(`📍 Bus Stop ${idx + 1} position updated!`);
          }
        });

        busMarker.on("click", (clickEvent: any) => {
          const target = clickEvent.originalEvent?.target;
          if (target && (target.classList.contains("delete-pin-c-btn") || target.innerText === "✕")) {
            clickEvent.originalEvent.stopPropagation();
            if (!canEditStops) return;
            
            // Delete this coordinate
            const updated = pinCStopsRef.current.filter((_, i) => i !== idx);
            setPinCStops(updated);
            syncStopsToRegistry(updated);
            if (updated.length > 0) {
              setBusStopLatLng(updated[0]);
              setActiveStopPopupIdx(0);
            } else {
              setBusPinSet(false);
              setActiveStopPopupIdx(null);
            }
            triggerToast(`✕ Removed Bus Stop ${idx + 1}`);
          } else {
            setActiveStopPopupIdx(idx);
          }
        });

        pinCMarkersRef.current.push(busMarker);
      });

      // Synchronize popup display on map
      if (activeStopPopupIdx !== null && activeStopPopupIdx < pinCMarkersRef.current.length) {
        const markerToOpen = pinCMarkersRef.current[activeStopPopupIdx];
        if (markerToOpen) {
          setTimeout(() => {
            if (markerToOpen && pickerMapInstance.hasLayer(markerToOpen)) {
              markerToOpen.openPopup();
            }
          }, 150);
        }
      }
    } else {
      // Clear markers if we leave Step 3
      pinCMarkersRef.current.forEach((marker: any) => {
        if (pickerMapInstance && pickerMapInstance.hasLayer(marker)) {
          pickerMapInstance.removeLayer(marker);
        }
      });
      pinCMarkersRef.current = [];
    }
  }, [pinCStops, pickerMapInstance, mapStep, canEditStops]);

  // Synchronize BUS marker when mapStep is toggled to 2
  useEffect(() => {
    if (pickerMapInstance) {
      if (mapStep === 2) {
        // Calculate midpoint of A and B to place the BUS pin
        const midLat = (pinALatLng.lat + pinBLatLng.lat) / 2;
        const midLng = (pinALatLng.lng + pinBLatLng.lng) / 2;
        
        // If pinCStops is empty, initialize it with midpoint
        if (pinCStops.length === 0) {
          const firstStop = { lat: midLat, lng: midLng };
          const snappedFirst = snapToRoute(firstStop);
          setPinCStops([snappedFirst]);
          setBusStopLatLng(snappedFirst);
          setBusPinSet(true);
          setActiveStopPopupIdx(null);
          syncStopsToRegistry([snappedFirst]);
        }

        // Pan and Zoom beautifully to the midpoint
        pickerMapInstance.setView([midLat, midLng], 14);
      }
    }
  }, [mapStep, pickerMapInstance]);

  // --- THEME SWAP ACTIONS ---
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("busStopTheme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }
  };

  // --- COLLAPSIBLES AND SIDEBARS ---
  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navigateToTab = (tab: "view" | "add" | "owner" | "about" | "settings" | "login" | "wishlist") => {
    setActiveTab(tab);
    setSelectedStopId(null);
    setIsMobileMenuOpen(false);
    try {
      window.location.hash = tab;
    } catch (e) {}
  };

  // --- BUS REGISTRY CONTROLLING ACTIONS ---
  
  // Submit new items
  const handleAddStopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userSession) {
      alert("❗ Please login first to save and contribute bus timings.");
      setActiveTab("login");
      return;
    }

    const { name, village, location, startRoute, endRoute, route, timings, gps, activeDays, excludedDays } = formData;

    if (!name.trim()) {
      alert("❗ Please enter District/Name (e.g. Karur, Trichy)!");
      return;
    }
    if (!location.trim()) {
      alert("❗ Please specify Bus Name/ID!");
      return;
    }
    if (!timings.trim()) {
      alert("❗ Please add at least one Bus Timing!");
      return;
    }

    // Parsing timings formatted commas
    const timingPills = timings
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    if (timingPills.length === 0) {
      alert("❗ No valid timings parsed! Use commas (e.g. 8:30 AM, 12:00 PM)");
      return;
    }

    const cleanStr = (str: string) => str.toLowerCase().replace(/\s+/g, "");
    
    // Check for duplicate routes or duplicate names to merge timings seamlessly
    const existingIndex = stops.findIndex(
      s => cleanStr(s.name) === cleanStr(name) && 
           cleanStr(s.village) === cleanStr(village) && 
           cleanStr(s.location) === cleanStr(location) &&
           (editModeId ? s.id !== editModeId : true)
     );

    // Document payload
    const currentDate = new Date().toLocaleDateString("en-IN");
    const currentTimestamp = Date.now();

    try {
      if (editModeId) {
        // Edit Mode Modification
        const updatedStops = [...stops];
        const editIndex = updatedStops.findIndex(s => s.id === editModeId);
        
        if (editIndex !== -1) {
          const editPayload: BusStop = {
            ...updatedStops[editIndex],
            name: name.trim(),
            village: village.trim(),
            location: location.trim(),
            startRoute: (startRoute || "").trim(),
            endRoute: (endRoute || "").trim(),
            route,
            timings: timingPills,
            gps: gps.trim(),
            date: currentDate,
            timestamp: currentTimestamp,
            activeDays: (activeDays || "All Days").trim(),
            excludedDays: (excludedDays || "").trim()
          };

          // 1. If Firestore ready, write online
          if (usingFirebaseRealtime && db) {
            try {
              await updateDoc(doc(db, "bus_updates", editModeId), {
                name: name.trim(),
                village: village.trim(),
                location: location.trim(),
                startRoute: (startRoute || "").trim(),
                endRoute: (endRoute || "").trim(),
                route,
                timings: timingPills,
                gps: gps.trim(),
                date: currentDate,
                timestamp: currentTimestamp,
                activeDays: (activeDays || "All Days").trim(),
                excludedDays: (excludedDays || "").trim()
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `bus_updates/${editModeId}`);
            }
          }

          // 2. Refresh local state only after successful Firebase write
          updatedStops[editIndex] = editPayload;
          handleStopsStateUpdate(updatedStops);
          
          triggerToast("🔄 Bus stop updated successfully!");
        }
      } else if (existingIndex !== -1) {
        // Merge Timings Action
        const existingData = stops[existingIndex];
        const combinedTimings = Array.from(new Set([...existingData.timings, ...timingPills]));

        if (usingFirebaseRealtime && db) {
          try {
            await updateDoc(doc(db, "bus_updates", existingData.id), {
              timings: combinedTimings,
              date: currentDate,
              timestamp: currentTimestamp
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `bus_updates/${existingData.id}`);
          }
        }

        const updatedStops = [...stops];
        updatedStops[existingIndex] = {
          ...existingData,
          timings: combinedTimings,
          date: currentDate,
          timestamp: currentTimestamp
        };
        handleStopsStateUpdate(updatedStops);
        
        triggerToast("🤝 New timings merged into current route!");
      } else {
        // Add completely new registry
        const newStop: Omit<BusStop, "id"> = {
          name: name.trim(),
          village: village.trim(),
          location: location.trim(),
          startRoute: (startRoute || "").trim(),
          endRoute: (endRoute || "").trim(),
          route,
          timings: timingPills,
          gps: gps.trim(),
          addedBy: userSession.name,
          creatorId: userSession.uid || userSession.id || undefined,
          creatorEmail: userSession.email || undefined,
          creatorUsername: userSession.username || undefined,
          date: currentDate,
          timestamp: currentTimestamp,
          activeDays: (activeDays || "All Days").trim(),
          excludedDays: (excludedDays || "").trim()
        };

        let generatedId = "local-" + Date.now();

        if (usingFirebaseRealtime && db) {
          try {
            const addedDocRef = await addDoc(collection(db, "bus_updates"), newStop);
            generatedId = addedDocRef.id;
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, "bus_updates");
          }
        }

        const addedStopWithId: BusStop = { ...newStop, id: generatedId };
        handleStopsStateUpdate([addedStopWithId, ...stops]);
        triggerToast("🎉 Bus stop added successfully!");
      }

      // Reset fields
      setFormData({
        name: "",
        village: "",
        location: "",
        startRoute: "",
        endRoute: "",
        route: "Medium Crowd",
        timings: "",
        gps: "",
        activeDays: "All Days",
        excludedDays: ""
      });
      setEditModeId(null);
      setIsEditing(false);
      setGpsStatus("none");
      
      // Navigate users to Console or View
      setActiveTab("view");
    } catch (error: any) {
      console.error("Submission failed entirely", error);
      const specificMsg = error instanceof Error ? error.message : String(error);
      alert(`❌ Submission error occurred. Details: ${specificMsg}`);
    }
  };

  // Switch to editing trigger
  const handleEditInit = (stop: BusStop) => {
    setFormData({
      name: stop.name,
      village: stop.village,
      location: stop.location,
      startRoute: stop.startRoute || "",
      endRoute: stop.endRoute || "",
      route: stop.route,
      timings: stop.timings.join(", "),
      gps: stop.gps || "",
      activeDays: stop.activeDays || "All Days",
      excludedDays: stop.excludedDays || ""
    });
    setEditModeId(stop.id);
    setIsEditing(true);
    if (stop.gps) {
      setGpsStatus("pinned");
    } else {
      setGpsStatus("none");
    }
    setActiveTab("add");
    setSelectedStopId(null);
  };

  // Delete single busTiming stop
  const handleDeleteStop = async (id: string) => {
    if (!window.confirm("⚠️ Are you sure you want to delete this bus timing?")) {
      return;
    }

    try {
      // 1. Update local UI state immediately for instant feedback on board and history log
      setStops(prevStops => prevStops.filter(s => s.id !== id));

      if (selectedStopId === id) {
        setSelectedStopId(null);
      }
      setIsEditing(false);

      // 2. Delete from Firestore database if connected and not purely local
      if (usingFirebaseRealtime && db && !id.startsWith("local-") && !id.startsWith("off-")) {
        try {
          await deleteDoc(doc(db, "bus_updates", id));
        } catch (err) {
          console.warn("Firestore document deletion notice:", err);
        }
      }

      triggerToast("🗑️ Bus stop timings removed from entries.");
    } catch (e) {
      console.error("Deletion failed", e);
      alert("❌ Deletion failed. " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Wipe all entries from state
  const handleClearAllRegistry = async () => {
    if (!window.confirm("❗ WARNING: This will immediately delete ALL of your added bus stops from this platform. Are you sure you want to proceed?")) {
      return;
    }

    try {
      if (!userSession) return;

      const myEntries = stops.filter(s => isMatchingOwner(s.addedBy, userSession, s.id));

      // Remove from local UI state immediately
      setStops(prevStops => prevStops.filter(s => !isMatchingOwner(s.addedBy, userSession, s.id)));

      if (selectedStopId && myEntries.some(e => e.id === selectedStopId)) {
        setSelectedStopId(null);
      }

      if (usingFirebaseRealtime && db) {
        for (const item of myEntries) {
          if (!item.id.startsWith("local-") && !item.id.startsWith("off-")) {
            try {
              await deleteDoc(doc(db, "bus_updates", item.id));
            } catch (err) {
              console.warn("Firestore wipe entry notice:", err);
            }
          }
        }
      }

      triggerToast("🗑️ All matching stops successfully wiped.");
    } catch (err) {
      console.error("Mass formatting error", err);
    }
  };

  // Helper to reset and cleanup any intermediate waypoints or alternative paths
  const resetRouteWaypoint = () => {
    if (pickerWaypointMarkerInstance) {
      pickerWaypointMarkerInstance.remove();
      setPickerWaypointMarkerInstance(null);
    }
    setWaypointLatLng(null);
    lastValidWaypointLatLngRef.current = null;
    if (alternativePolylinesRef.current && alternativePolylinesRef.current.length > 0) {
      alternativePolylinesRef.current.forEach((layer: any) => {
        if (pickerMapInstance && pickerMapInstance.hasLayer(layer)) {
          pickerMapInstance.removeLayer(layer);
        }
      });
      alternativePolylinesRef.current = [];
    }
  };

  // Quick alert toaster
  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => {
      setShowToast("");
    }, 4000);
  };

  // Register global listener for Leaflet marker reset click handlers
  useEffect(() => {
    (window as any).clearPinA = () => {
      setPinASet(false);
      setRouteDistance(null);
      setRouteDuration(null);
      setActivePinSelector("A");
      
      if (pickerMarkerInstance) {
        pickerMarkerInstance.remove();
      }
      if (pickerPolylineInstance) {
        pickerPolylineInstance.remove();
      }
      resetRouteWaypoint();
      triggerToast("✕ Start Location pin has been cleared.");
    };

    (window as any).clearPinB = () => {
      setPinBSet(false);
      setRouteDistance(null);
      setRouteDuration(null);
      setActivePinSelector("B");
      
      if (pickerMarkerBInstance) {
        pickerMarkerBInstance.remove();
      }
      if (pickerPolylineInstance) {
        pickerPolylineInstance.remove();
      }
      resetRouteWaypoint();
      triggerToast("✕ End Location pin has been cleared.");
    };

    (window as any).clearMapPinsEverything = () => {
      const defaultALatLng = { lat: 10.7905, lng: 78.7047 };
      const defaultBLatLng = { lat: 10.9578, lng: 78.0764 };
      
      setPinASet(false);
      setPinBSet(false);
      setBusPinSet(false);
      setRouteDistance(null);
      setRouteDuration(null);
      setActivePinSelector("A");
      setMapSearchText("");
      setMapSearchSuggestions([]);
      
      setPinALatLng(defaultALatLng);
      setPinBLatLng(defaultBLatLng);
      
      if (pickerMarkerInstance) {
        pickerMarkerInstance.remove();
      }
      if (pickerMarkerBInstance) {
        pickerMarkerBInstance.remove();
      }
      if (pickerPolylineInstance) {
        pickerPolylineInstance.remove();
      }
      resetRouteWaypoint();
      triggerToast("✕ Map pins and calculated route have been successfully cleared!");
    };

    return () => {
      delete (window as any).clearPinA;
      delete (window as any).clearPinB;
      delete (window as any).clearMapPinsEverything;
    };
  }, [pickerMarkerInstance, pickerMarkerBInstance, pickerPolylineInstance, isSatelliteMode]);

  // Keep Leaflet map layer visibility in sync with pinASet / pinBSet states
  useEffect(() => {
    if (pickerMapInstance) {
      if (pickerMarkerInstance) {
        if (pinASet) {
          if (!pickerMapInstance.hasLayer(pickerMarkerInstance)) {
            pickerMarkerInstance.addTo(pickerMapInstance);
          }
        } else {
          pickerMarkerInstance.remove();
        }
      }
      if (pickerMarkerBInstance) {
        if (pinBSet) {
          if (!pickerMapInstance.hasLayer(pickerMarkerBInstance)) {
            pickerMarkerBInstance.addTo(pickerMapInstance);
          }
        } else {
          pickerMarkerBInstance.remove();
        }
      }
      if (pickerPolylineInstance) {
        if (pinASet && pinBSet) {
          if (!pickerMapInstance.hasLayer(pickerPolylineInstance)) {
            pickerPolylineInstance.addTo(pickerMapInstance);
          }
        } else {
          pickerPolylineInstance.remove();
        }
      }
    }
  }, [pickerMapInstance, pickerMarkerInstance, pickerMarkerBInstance, pickerPolylineInstance, pinASet, pinBSet]);

  // --- LOCATION PINNING CONTROLS ---
  const toggleMapTileMode = () => {
    const nextMode = !isSatelliteMode;
    setIsSatelliteMode(nextMode);
    
    if (pickerMapInstance) {
      const L = (window as any).L;
      if (!L) return;
      
      // Remove all tile layers
      pickerMapInstance.eachLayer((layer: any) => {
        if (layer instanceof L.TileLayer) {
          pickerMapInstance.removeLayer(layer);
        }
      });
      
      // Add the new tile layer
      const url = nextMode 
        ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" 
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const attr = nextMode ? "&copy; Google Satellite Imagery" : "&copy; OpenStreetMap contributors";
      L.tileLayer(url, { 
        attribution: attr,
        maxZoom: 22,
        maxNativeZoom: nextMode ? 19 : 18
      }).addTo(pickerMapInstance);
    }
  };

  const handleSearchMapQueryChange = async (queryStr: string) => {
    if (!queryStr.trim()) {
      setMapSearchSuggestions([]);
      return;
    }

    // 1. Local filter from existing bus stops (updates immediately!)
    const locals = stops
      .filter(s => 
        (s.name || "").toLowerCase().includes(queryStr.toLowerCase()) || 
        (s.village || "").toLowerCase().includes(queryStr.toLowerCase())
      )
      .map(s => {
        const parts = (s.gps || "10.7905, 78.7047").split(",").map(p => parseFloat(p.trim()));
        return {
          name: `${s.village}, ${s.name}`,
          display_name: `${s.village}, ${s.name} (Existing Timing Board)`,
          lat: parts[0] || 10.7905,
          lon: parts[1] || 78.7047,
          sub: `Bus stop point for ${s.location}`
        };
      });

    // Deduplicate locals and show them instantly
    const uniqueLocals = Array.from((new (window as any).Map(locals.map(item => [item.display_name, item])) as any).values()) as any[];
    setMapSearchSuggestions(uniqueLocals.slice(0, 4));

    // Clear previous scheduled API geocode fetches to debounce fast typing
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 2. Fetch from free OSM Nominatim AND our specialized Gemini India Geocoder after user stops typing (length >= 3)
    if (queryStr.length >= 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const [nominatimPromise, geminiPromise] = [
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr + ", India")}&limit=6`)
              .then(r => r.json())
              .catch(() => []),
            fetch(`/api/geocode?q=${encodeURIComponent(queryStr)}`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          ];

          const [nominatimData, geminiData] = await Promise.all([nominatimPromise, geminiPromise]);
          
          let apiResults: any[] = [];

          // If Gemini geocoded successfully, put it at the very top of search results!
          if (geminiData && geminiData.latitude && geminiData.longitude) {
            apiResults.push({
              name: geminiData.name,
              display_name: `✨ AI: ${geminiData.name}, ${geminiData.state} (India Only)`,
              lat: geminiData.latitude,
              lon: geminiData.longitude,
              sub: geminiData.fallbackUsed 
                ? `Nearest geographical city landmark (Safe Offline Backup)` 
                : `Extracted via Gemini AI Geocoder (Strictly inside India)`
            });
          }

          if (nominatimData && Array.isArray(nominatimData)) {
            nominatimData.forEach((item: any) => {
              const disp = (item.display_name || "").toLowerCase();
              // Filter results strictly to India as ordered
              if (disp.includes("india")) {
                apiResults.push({
                  name: item.name || item.display_name.split(",")[0],
                  display_name: item.display_name,
                  lat: parseFloat(item.lat),
                  lon: parseFloat(item.lon),
                  sub: item.type === "administrative" ? "Administrative Boundary Node" : "Location Coordinate Map"
                });
              }
            });
          }

          const combined = [...uniqueLocals, ...apiResults];
          const uniqueCombined = Array.from((new (window as any).Map(combined.map(item => [item.display_name, item])) as any).values()) as any[];
          setMapSearchSuggestions(uniqueCombined.slice(0, 10));
        } catch (err) {
          console.warn("Geocoding service fetch failed:", err);
        }
      }, 600); // 600ms typing debounce delay
    }
  };

  const handleSelectMapSuggestion = (item: any) => {
    setMapSearchText(item.name);
    setMapSearchSuggestions([]);
    
    if (pickerMapInstance) {
      const L = (window as any).L;
      if (!L) return;
      
      const newLatLng = new L.LatLng(item.lat, item.lon || item.lng);
      pickerMapInstance.setView(newLatLng, 17); // Deep zoom in as requested!
      
      if (mapStep === 2 || activePinSelector === "BUS") {
        const rawStop = { lat: item.lat, lng: item.lon || item.lng };
        const snappedStop = snapToRoute(rawStop);
        setPinCStops(prev => {
          const next = [...prev, snappedStop];
          triggerToast(`🔴 Added Bus Stop ${next.length} from search!`);
          return next;
        });
        setBusStopLatLng(snappedStop);
        setBusPinSet(true);
      } else if (activePinSelector === "A") {
        if (pickerMarkerInstance) {
          pickerMarkerInstance.setLatLng(newLatLng);
        }
        setPinALatLng({ lat: item.lat, lng: item.lon || item.lng });
        setPinASet(true);
      } else {
        if (pickerMarkerBInstance) {
          pickerMarkerBInstance.setLatLng(newLatLng);
        }
        setPinBLatLng({ lat: item.lat, lng: item.lon || item.lng });
        setPinBSet(true);
      }

      // Sync polyline with road route when selected from search terms
      if (pickerPolylineInstance && pickerMarkerInstance && pickerMarkerBInstance) {
        setTimeout(() => {
          const pA = pickerMarkerInstance.getLatLng();
          const pB = pickerMarkerBInstance.getLatLng();
          fetchOSRMRoute(pA, pB, pickerPolylineInstance);
        }, 30);
      }
    }
  };

  const isBetweenPoints = (p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    // 0.1 degree is ~11km. This creates an elegant route corridor check
    const pad = 0.12;
    const minLat = Math.min(a.lat, b.lat) - pad;
    const maxLat = Math.max(a.lat, b.lat) + pad;
    const minLng = Math.min(a.lng, b.lng) - pad;
    const maxLng = Math.max(a.lng, b.lng) + pad;
    return p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng;
  };

  const handleSaveMapCoordinates = () => {
    if (pinCStops.length > 0) {
      const coordStr = pinCStops.map((p, i) => {
        let label = `Bus Stop ${i+1}: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
        if (p.busName) label += ` (${p.busName})`;
        if (p.departureTime) label += ` [Dep: ${p.departureTime}]`;
        return label;
      }).join(" | ");
      setFormData(prev => ({ 
        ...prev, 
        gps: coordStr 
      }));
      setGpsStatus("pinned");
      triggerToast(`✅ Attached ${pinCStops.length} Bus Stop coordinates successfully!`);
    } else if (busStopLatLng) {
      const coordStr = `${busStopLatLng.lat.toFixed(6)}, ${busStopLatLng.lng.toFixed(6)}`;
      setFormData(prev => ({ 
        ...prev, 
        gps: coordStr 
      }));
      setGpsStatus("pinned");
      triggerToast("✅ Bus Stop coordinate attached successfully!");
    } else {
      const selectedPin = belongsToPin || "A";
      const coordObj = selectedPin === "A" ? pinALatLng : pinBLatLng;
      if (coordObj) {
         const coordStr = `${coordObj.lat.toFixed(6)}, ${coordObj.lng.toFixed(6)}`;
         setFormData(prev => ({ ...prev, gps: coordStr }));
         setGpsStatus("pinned");
         triggerToast("✅ Location coordinates attached successfully!");
      }
    }
    setMapSearchText("");
    setMapSearchSuggestions([]);
    setMapModalOpen(false);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      triggerToast(language === "ta" ? "❌ உங்கள் உலாவி புவிஇருப்பிடத்தை ஆதரிக்கவில்லை!" : "❌ Geolocation is not supported by your browser!");
      return;
    }

    triggerToast(language === "ta" ? "🛰️ இருப்பிடத்தைத் தேடுகிறது..." : "🛰️ Fetching GPS location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
        setFormData(prev => ({ ...prev, gps: coords }));
        setGpsStatus("pinned");
        triggerToast(language === "ta" ? "📍 ஜிபிஎஸ் இருப்பிடம் வெற்றிகரமாக கண்டறியப்பட்டது!" : "📍 GPS Coordinates detected via device!");
      },
      (error) => {
        console.warn("Geolocation reading error:", error);
        setGpsStatus("error");
        if (error.code === error.TIMEOUT) {
          triggerToast(
            language === "ta" 
              ? "❌ இருப்பிடத் தேடல் காலாவதியானது! வரைபடத்தில் கைமுறையாகப் பின செய்யவும்." 
              : "❌ GPS Timeout! Please try again or pin on the map manually."
          );
        } else {
          triggerToast(
            language === "ta" 
              ? "❌ இருப்பிடத்தை கண்டறிய முடியவில்லை! உலாவி அமைப்பில் அனுமதியை சரிபார்க்கவும்." 
              : "❌ Could not detect hardware location. Ensure Location Services are active or pin manually on the map."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  };

  // --- EMAIL & SOCIAL AUTHENTICATION ---
  const handleAuthenticationAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    const { name, email, password } = authForm;

    if (!email.trim() || !password.trim()) {
      setAuthError("❗ Please enter both email address and password.");
      return;
    }

    if (authMode === "register" && !name.trim()) {
      setAuthError("❗ Please enter your name.");
      return;
    }

    if (!firebaseInitialized || !auth) {
      setAuthError("❗ Firebase Authentication is not initialized. Please verify your configuration.");
      return;
    }

    try {
      if (authMode === "register") {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, {
          displayName: name.trim()
        });

        const sess: UserSession = {
          uid: userCred.user.uid,
          id: userCred.user.uid,
          username: email.split("@")[0],
          name: name.trim(),
          email: email.trim(),
          type: "firebase_live"
        };
        setUserSession(sess);
        localStorage.setItem("busStopSess_v1", JSON.stringify(sess));
        setAuthSuccess("✅ Account successfully registered and signed in!");

        setTimeout(() => {
          setActiveTab("view");
          setAuthForm({ name: "", email: "", password: "" });
          setAuthSuccess("");
        }, 1500);

      } else {
        // LOGIN PROCESS
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const displayName = userCred.user.displayName || email.split("@")[0];

        const sess: UserSession = {
          uid: userCred.user.uid,
          id: userCred.user.uid,
          username: email.split("@")[0],
          name: displayName,
          email: email.trim(),
          type: "firebase_live"
        };
        setUserSession(sess);
        localStorage.setItem("busStopSess_v1", JSON.stringify(sess));
        setAuthSuccess("✅ Signed in successfully!");

        setTimeout(() => {
          setActiveTab("view");
          setAuthForm({ name: "", email: "", password: "" });
          setAuthSuccess("");
        }, 1500);
      }
    } catch (err: any) {
      console.error("Auth error", err);
      // Clean and readable error messaging
      if (err.code === "auth/email-already-in-use") {
        setAuthError("❗ This email ID is already registered. Switch to Login tab.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setAuthError("❗ Incorrect password or invalid details.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("❗ Password must be at least 6 characters.");
      } else {
        setAuthError(`Error: ${err.message || "Failed to authenticate."}`);
      }
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      triggerToast("❗ Please enter a valid email address.");
      return;
    }

    setResetLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      if (firebaseInitialized && auth) {
        await sendPasswordResetEmail(auth, resetEmail.trim());
        triggerToast("📧 Password reset link sent to your email successfully!");
        setAuthSuccess("📧 Reset link sent! Check your email inbox to reset your password.");
        setResetEmail("");
        setShowResetModal(false);
      } else {
        triggerToast("📧 [Simulation] Reset link successfully sent to: " + resetEmail);
        setAuthSuccess("📧 [Simulation Sandbox] Reset link sent to " + resetEmail);
        setResetEmail("");
        setShowResetModal(false);
      }
    } catch (err: any) {
      console.error("Password reset error:", err);
      let errorMsg = err.message || "Failed to send reset email.";
      if (err.code === "auth/user-not-found") {
        errorMsg = "❗ No registered account found with this email.";
      } else if (err.code === "auth/invalid-email") {
        errorMsg = "❗ Please enter a valid email address.";
      }
      triggerToast(errorMsg);
      setAuthError(errorMsg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleSingleSignOn = async () => {
    setAuthError("");
    setAuthSuccess("");
    
    if (!firebaseInitialized || !auth || !googleProvider) {
      setAuthError("❗ Firebase Authentication is not initialized. Please verify your configuration.");
      return;
    }
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const sess: UserSession = {
        uid: user.uid,
        id: user.uid,
        username: user.email?.split("@")[0] || "google_user",
        name: user.displayName || "Google Contributor",
        email: user.email || "",
        photo: user.photoURL,
        type: "google_live"
      };
      setUserSession(sess);
      localStorage.setItem("busStopSess_v1", JSON.stringify(sess));
      setAuthSuccess("✅ Google Authentication completed!");
      
      setTimeout(() => {
        setActiveTab("view");
      }, 1200);
    } catch (err: any) {
      console.error("Google Auth failed", err);
      setAuthError(`❗ Sign-in failed: ${err.message || "Credential window closed"}`);
    }
  };








  const handleLogout = async () => {
    if (firebaseInitialized && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("Firebase signout error", e);
      }
    }
    setUserSession(null);
    localStorage.removeItem("busStopSess_v1");
    triggerToast("🚪 Logged out successfully. See you again!");
    setActiveTab("view");
  };

  // --- SEARCH AND FILTER FILTERING PIPELINES ---
  const filteredStops = stops.filter(s => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      (s.name || "").toLowerCase().includes(term) ||
      (s.village || "").toLowerCase().includes(term) ||
      (s.location || "").toLowerCase().includes(term);

    const matchesDistrict = selectedDistrictFilter === "All" || s.name === selectedDistrictFilter;

    return matchesSearch && matchesDistrict;
  });

  // Extract unique city/state/districts for quick category filtering
  const uniqueDistricts: string[] = ["All", ...Array.from(new Set(stops.map(s => s.name).filter(Boolean))) as any];

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${
      theme === "dark" 
        ? "bg-[#090b0f] text-[#f0ede8]" 
        : "bg-[#f4f6fa] text-[#090b0f]"
    }`}>
      
      {/* ── TOAST NOTIFICATIONS ── */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-brand-yellow-light text-black px-6 py-4 rounded-xl shadow-2xl font-bold border-l-4 border-brand-yellow animate-bounce text-sm">
          <CheckCircle2 className="w-5 h-5" />
          <span>{showToast}</span>
        </div>
      )}

      {/* ── MOBILE HEADER (Visible only on touch layout phones) ── */}
      <header className={`md:hidden flex items-center justify-between px-5 py-4 border-b z-40 sticky top-0 backdrop-blur-md ${
        theme === "dark" 
          ? "bg-[#0d0f18]/90 border-[#1c1f33]/85" 
          : "bg-white/90 border-[#ced0d4]/80"
      }`}>
        <div className="flex items-center gap-3" onClick={() => navigateToTab("view")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-yellow to-orange-500 flex items-center justify-center text-black font-extrabold text-xl shadow-md">
            🚌
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xs tracking-wider leading-none text-brand-yellow">USER STOP</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell Icon */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className={`relative p-2 rounded-xl border text-sm transition-all active:scale-95 cursor-pointer ${
              theme === "dark" ? "border-[#2e3150] bg-[#1a1d27]" : "border-[#ced0d4] bg-white"
            }`}
            aria-label="Notifications"
            title="Bus stop reports & notifications"
          >
            <Bell className={`w-4 h-4 ${notifications.some(n => !n.read) ? "text-red-400 animate-bounce" : "text-brand-yellow"}`} />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>

          {/* Theme Switcher */}
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-xl border text-sm transition-all active:scale-95 ${
              theme === "dark" ? "border-[#2e3150] bg-[#1a1d27]" : "border-[#ced0d4] bg-white"
            }`}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-brand-yellow" /> : <Moon className="w-4 h-4 text-[#090b0f]" />}
          </button>

          {/* User quick pill */}
          {userSession ? (
            <a 
              href="#login"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("login"); }} 
              className="w-8 h-8 rounded-full bg-brand-yellow text-black flex items-center justify-center font-bold text-xs ring-2 ring-amber-300"
              title={userSession.name}
            >
              {userSession.name.slice(0, 2).toUpperCase()}
            </a>
          ) : (
            <a 
              href="#login"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("login"); }} 
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                theme === "dark" ? "border-[#2e3150] bg-[#1a1d27]" : "border-[#ced0d4] bg-white"
              }`}
            >
              <LogIn className="w-4 h-4 text-brand-yellow" />
            </a>
          )}

          {/* Mobile hamburger menu */}
          <button 
            onClick={toggleMobileMenu} 
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              theme === "dark" ? "border-[#2e3150] bg-[#1a1d27]" : "border-[#ced0d4] bg-white"
            }`}
            aria-label="Open Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-red-500" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── MOBILE NAVIGATION PANEL (Sliding full layout drawer) ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          {/* Backdrop */}
          <div 
            onClick={toggleMobileMenu} 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Drawer body */}
          <div className={`relative w-[280px] max-w-[85vw] h-full flex flex-col p-6 z-40 transition-transform duration-300 overflow-y-auto ${
            theme === "dark" ? "bg-[#0f1117]" : "bg-white"
          }`}>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-yellow to-orange-500 flex items-center justify-center text-black font-extrabold text-2xl shadow-lg">
                🚌
              </div>
              <div>
                <h1 className="font-display font-extrabold text-sm tracking-wide">TN BUS STOP</h1>
                <p className="text-[10px] text-brand-yellow font-extrabold uppercase mt-0.5">COMMUNITY REGISTRY</p>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 flex flex-col gap-2.5">
              <a 
                href="#view"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("view"); }} 
                className={`w-full py-4 px-5 rounded-xl font-bold flex items-center gap-4 text-left transition-all ${
                  activeTab === "view"
                    ? "bg-brand-yellow-light text-black shadow-md shadow-amber-500/10"
                    : theme === "dark" ? "text-[#7a7f96] hover:bg-[#1a1d27]" : "text-[#65676b] hover:bg-[#e4e6eb]"
                }`}
              >
                <Bus className="w-5 h-5" />
                <span className="uppercase">{t("home_board")}</span>
              </a>

              <a 
                href="#add"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("add"); }} 
                className={`w-full py-4 px-5 rounded-xl font-bold flex items-center gap-4 text-left transition-all ${
                  activeTab === "add"
                    ? "bg-brand-yellow-light text-black shadow-md shadow-amber-500/10"
                    : theme === "dark" ? "text-[#7a7f96] hover:bg-[#1a1d27]" : "text-[#65676b] hover:bg-[#e4e6eb]"
                }`}
              >
                <PlusCircle className="w-5 h-5" />
                <span className="uppercase">{t("add_stop")}</span>
              </a>

              <a 
                href="#owner"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("owner"); }} 
                className={`w-full py-4 px-5 rounded-xl font-bold flex items-center gap-4 text-left transition-all ${
                  activeTab === "owner"
                    ? "bg-brand-yellow-light text-black shadow-md shadow-amber-500/10"
                    : theme === "dark" ? "text-[#7a7f96] hover:bg-[#1a1d27]" : "text-[#65676b] hover:bg-[#e4e6eb]"
                }`}
              >
                <Gauge className="w-5 h-5" />
                <span className="uppercase">{t("console_hub")}</span>
              </a>

              <a 
                href="#wishlist"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("wishlist"); }} 
                className={`w-full py-4 px-5 rounded-xl font-bold flex items-center gap-4 text-left transition-all ${
                  activeTab === "wishlist"
                    ? "bg-brand-yellow-light text-black shadow-md shadow-amber-500/10"
                    : theme === "dark" ? "text-[#7a7f96] hover:bg-[#1a1d27]" : "text-[#65676b] hover:bg-[#e4e6eb]"
                }`}
              >
                <Star className="w-5 h-5" />
                <span className="uppercase">{t("wishlist")}</span>
              </a>

              <a 
                href="#settings"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("settings"); }} 
                className={`w-full py-4 px-5 rounded-xl font-bold flex items-center gap-4 text-left transition-all ${
                  activeTab === "settings"
                    ? "bg-brand-yellow-light text-black shadow-md shadow-amber-500/10"
                    : theme === "dark" ? "text-[#7a7f96] hover:bg-[#1a1d27]" : "text-[#65676b] hover:bg-[#e4e6eb]"
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="uppercase">{t("settings")}</span>
              </a>
            </nav>

            {/* Profile footer section */}
            <div className={`mt-auto pt-6 border-t ${
              theme === "dark" ? "border-[#1c1f33]" : "border-[#ced0d4]"
            }`}>
              {userSession ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-yellow text-black flex items-center justify-center font-bold text-sm">
                      {userSession.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm truncate max-w-[150px]">{userSession.name}</h4>
                      <p className="text-xs text-[#7a7f96] truncate max-w-[150px]">@{userSession.username}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-500/40 text-red-500 font-bold hover:bg-red-500/10 active:scale-95 transition-all text-xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>🚪 SIGN OUT</span>
                  </button>
                </div>
              ) : (
                <a 
                  href="#login"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("login"); }}
                  className="w-full py-3.5 px-4 bg-brand-yellow text-black rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                >
                  <LogIn className="w-5 h-5" />
                  <span>SIGN IN ONLINE</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DESKTOP PERMANENT SIDEBAR Layout ── */}
      <aside className={`hidden md:flex flex-col py-8 px-6 border-r flex-shrink-0 transition-all duration-300 z-30 sticky top-0 h-screen overflow-y-auto ${
        isSidebarCollapsed ? "w-[100px]" : "w-[300px]"
      } ${
        theme === "dark" 
          ? "bg-[#0a0c14] border-[#1c1f33]" 
          : "bg-white border-[#ced0d4]"
      }`}>
        {/* LOGO */}
        <div className={`flex items-center gap-4 mb-10 ${isSidebarCollapsed ? "justify-center" : ""}`}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-yellow to-orange-500 flex items-center justify-center text-black font-extrabold text-2xl shadow-md cursor-pointer hover:rotate-6 transition-transform" onClick={toggleSidebar}>
            🚌
          </div>
          {!isSidebarCollapsed && (
            <div>
              <h1 className="font-display font-extrabold text-md tracking-wider leading-none text-brand-yellow">USER STOP</h1>
            </div>
          )}
        </div>

        {/* LINKS */}
        <nav className="flex-grow flex flex-col gap-3">
          <a 
            href="#view"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("view"); }} 
            className={`w-full py-4 rounded-2xl font-bold flex items-center gap-4 text-left transition-all relative ${
              isSidebarCollapsed ? "justify-center px-0" : "px-5"
            } ${
              activeTab === "view"
                ? "bg-brand-yellow-light text-black shadow-xl shadow-amber-500/10"
                : theme === "dark" ? "text-[#7a7f96] hover:bg-[#151a26]" : "text-[#65676b] hover:bg-[#e4e6eb]"
            }`}
            title="All Bus Stops"
          >
            <Bus className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="tracking-wide">{t("home_board")}</span>}
          </a>

          <a 
            href="#add"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("add"); }} 
            className={`w-full py-4 rounded-2xl font-bold flex items-center gap-4 text-left transition-all ${
              isSidebarCollapsed ? "justify-center px-0" : "px-5"
            } ${
              activeTab === "add"
                ? "bg-brand-yellow-light text-black shadow-xl shadow-amber-500/10"
                : theme === "dark" ? "text-[#7a7f96] hover:bg-[#151a26]" : "text-[#65676b] hover:bg-[#e4e6eb]"
            }`}
            title="Add Bus Stop"
          >
            <PlusCircle className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="tracking-wide">{t("add_stop")}</span>}
          </a>

          <a 
            href="#owner"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("owner"); }} 
            className={`w-full py-4 rounded-2xl font-bold flex items-center gap-4 text-left transition-all ${
              isSidebarCollapsed ? "justify-center px-0" : "px-5"
            } ${
              activeTab === "owner"
                ? "bg-brand-yellow-light text-black shadow-xl shadow-amber-500/10"
                : theme === "dark" ? "text-[#7a7f96] hover:bg-[#151a26]" : "text-[#65676b] hover:bg-[#e4e6eb]"
            }`}
            title="Owner Space"
          >
            <Gauge className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="tracking-wide">{t("console_hub")}</span>}
          </a>

          <a 
            href="#wishlist"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("wishlist"); }} 
            className={`w-full py-4 rounded-2xl font-bold flex items-center gap-4 text-left transition-all ${
              isSidebarCollapsed ? "justify-center px-0" : "px-5"
            } ${
              activeTab === "wishlist"
                ? "bg-brand-yellow-light text-black shadow-xl shadow-amber-500/10"
                : theme === "dark" ? "text-[#7a7f96] hover:bg-[#151a26]" : "text-[#65676b] hover:bg-[#e4e6eb]"
            }`}
            title="Wishlist"
          >
            <Star className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="tracking-wide">{t("wishlist")}</span>}
          </a>

          <a 
            href="#settings"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("settings"); }} 
            className={`w-full py-4 rounded-2xl font-bold flex items-center gap-4 text-left transition-all ${
              isSidebarCollapsed ? "justify-center px-0" : "px-5"
            } ${
              activeTab === "settings"
                ? "bg-brand-yellow-light text-black shadow-xl shadow-amber-500/10"
                : theme === "dark" ? "text-[#7a7f96] hover:bg-[#151a26]" : "text-[#65676b] hover:bg-[#e4e6eb]"
            }`}
            title="Settings"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="tracking-wide">{t("settings")}</span>}
          </a>
        </nav>

        {/* CONTROLS & USER SECTION */}
        <div className={`pt-6 border-t flex flex-col gap-4 ${
          theme === "dark" ? "border-[#1c1f33]" : "border-[#ced0d4]"
        }`}>
          {/* Notifications button */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className={`w-full py-3.5 px-4 rounded-xl border flex items-center cursor-pointer font-bold gap-3 transition-colors ${
              isSidebarCollapsed ? "justify-center px-0" : ""
            } ${
              theme === "dark" ? "border-[#2e3150] bg-[#1a1d27] hover:bg-[#222537]" : "border-[#ced0d4] bg-[#e4e6eb] hover:bg-[#d8dadf]"
            }`}
            title="Notifications & Reports"
          >
            <div className="relative flex-shrink-0">
              <Bell className={`w-5 h-5 ${notifications.some(n => !n.read) ? "text-red-400 animate-bounce" : "text-brand-yellow"}`} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs">NOTIFICATIONS</span>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-red-500/30">
                    {notifications.filter(n => !n.read).length} NEW
                  </span>
                )}
              </div>
            )}
          </button>

          {/* Quick theme toggler row */}
          <button 
            onClick={toggleTheme}
            className={`w-full py-3.5 px-4 rounded-xl border flex items-center cursor-pointer font-bold gap-3 transition-colors ${
              isSidebarCollapsed ? "justify-center px-0" : ""
            } ${
              theme === "dark" ? "border-[#2e3150] bg-[#1a1d27] hover:bg-[#222537]" : "border-[#ced0d4] bg-[#e4e6eb] hover:bg-[#d8dadf]"
            }`}
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-5 h-5 text-brand-yellow" />
                {!isSidebarCollapsed && <span className="text-xs">LIGHT THEME</span>}
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-[#090b0f]" />
                {!isSidebarCollapsed && <span className="text-xs">DARK THEME</span>}
              </>
            )}
          </button>

          {/* User badge */}
          {userSession ? (
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : ""}`}>
              <a 
                href="#login"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("login"); }}
                className="w-10 h-10 rounded-full bg-brand-yellow text-black flex items-center justify-center font-extrabold text-sm shadow-md cursor-pointer"
              >
                {userSession.name.slice(0, 2).toUpperCase()}
              </a>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-xs truncate max-w-[140px]">{userSession.name}</h4>
                  <button 
                    onClick={handleLogout} 
                    className="text-[10px] text-red-500 font-bold uppercase tracking-wider block mt-0.5 hover:underline"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a 
              href="#login"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("login"); }}
              className={`w-full py-3.5 bg-brand-yellow text-black rounded-xl font-bold flex items-center gap-3 transition-transform active:scale-95 shadow-md ${
                isSidebarCollapsed ? "justify-center px-0" : "px-4"
              }`}
              title="Sign in to platform"
            >
              <LogIn className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span className="text-xs uppercase tracking-wider font-extrabold">Login Online</span>}
            </a>
          )}
        </div>
      </aside>

      {/* ── MAIN WORKSPACE CONTENT AREA ── */}
      <main className="flex-1 min-h-screen flex flex-col px-4 py-6 md:px-12 md:py-10 max-w-5xl mx-auto w-full pb-24 md:pb-12">
        {usingFirebaseRealtime && (
          <div className="text-[11px] text-emerald-500 font-semibold mb-3 flex items-center gap-1.5 justify-end w-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span>REAL-TIME FIREBASE DATABASE CONNECTED</span>
          </div>
        )}

        {/* ── ROUTING INTERACTIVE PAGES ── */}

        {/* VIEW 1: DETAIL DISCOVERY CARDS */}
        {selectedStopId && (
          <div className="animate-fade-in">
            {/* Back header navigation */}
            <button 
              onClick={() => setSelectedStopId(null)}
              className={`mb-6 py-2.5 px-4 rounded-xl border flex items-center gap-2 font-bold text-xs transition-colors self-start cursor-pointer ${
                theme === "dark" ? "border-[#2e3150] bg-[#1a1d27] hover:bg-[#222537]" : "border-[#ced0d4] bg-white hover:bg-[#e4e6eb]"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t("back_to_board")}</span>
            </button>

            {/* Fetch specific stop */}
            {(() => {
              const item = stops.find(s => s.id === selectedStopId);
              if (!item) {
                return (
                  <div className="text-center py-12">
                    <p className="text-[#7a7f96]">{t("detail_missing")}</p>
                    <button onClick={() => setSelectedStopId(null)} className="mt-4 px-4 py-2 bg-brand-yellow text-black font-bold rounded-lg"></button>
                  </div>
                );
              }

              return (
                <div className={`p-6 rounded-2xl border ${
                  theme === "dark" ? "bg-[#131622] border-[#202438]" : "bg-white border-[#e4e8f1]"
                } shadow-xl max-w-3xl mx-auto`}>
                  
                  {/* Title block */}
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <span className="text-brand-yellow text-[11px] tracking-widest font-extrabold uppercase block mb-1">{t("user_stop_badge")}</span>
                      <h2 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight leading-tight">
                        🚌 {item.name}, <span className="text-brand-yellow">{item.village}</span>
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Like Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleLike(item.id, e)}
                        className={`p-2 px-3 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border ${
                          likedStops.includes(item.id)
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : theme === "dark" ? "bg-[#1a1d27] border-[#2e3150] text-neutral-400 hover:text-amber-400" : "bg-neutral-100 border-neutral-300 text-neutral-500 hover:text-amber-500"
                        }`}
                        title={likedStops.includes(item.id) ? "Unlike" : "Like"}
                      >
                        <ThumbsUp 
                          className={`w-4 h-4 transition-all duration-200 active:scale-125 ${
                            likedStops.includes(item.id) 
                              ? "fill-amber-400 text-amber-400" 
                              : "text-neutral-400 hover:text-amber-400"
                          }`} 
                        />
                        {Boolean(item.likeCount && item.likeCount > 0) && (
                          <span className={`text-xs font-bold ${likedStops.includes(item.id) ? "text-amber-400" : ""}`}>
                            {item.likeCount}
                          </span>
                        )}
                      </button>

                      {/* Wishlist Star Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleStar(item.id, e)}
                        className={`p-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border ${
                          starredStops.includes(item.id)
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : theme === "dark" ? "bg-[#1a1d27] border-[#2e3150] text-neutral-400 hover:text-amber-400" : "bg-neutral-100 border-neutral-300 text-neutral-500 hover:text-amber-500"
                        }`}
                        title={starredStops.includes(item.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                      >
                        <Star 
                          className={`w-4 h-4 transition-all duration-200 active:scale-125 ${
                            starredStops.includes(item.id) 
                              ? "fill-amber-400 text-amber-400" 
                              : "text-neutral-400 hover:text-amber-400"
                          }`} 
                        />
                      </button>

                      <div className={`px-4 py-1.5 rounded-full font-bold text-xs ${
                        item.route.includes("High") 
                          ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                          : item.route.includes("Medium") 
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}>
                        {item.route === "High Crowd" ? t("high_crowd") : item.route === "Medium Crowd" || item.route.includes("Medium") ? t("medium_crowd") : t("low_crowd")}
                      </div>
                    </div>
                  </div>

                  {/* Body description entries */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className={`p-4 rounded-xl border md:col-span-2 ${
                      theme === "dark" ? "bg-[#1a1d27]/40 border-[#2e3150]/60" : "bg-[#f8f9fa] border-[#ced0d4]/60"
                    }`}>
                      <p className="text-xs text-[#7a7f96] font-bold uppercase tracking-wider mb-0.5">{t("bus_name_no_lbl")}</p>
                      <h4 className="font-extrabold text-md">{item.location}</h4>
                    </div>

                    {item.startRoute && item.endRoute && (
                      <div className={`p-4 rounded-xl border md:col-span-2 ${
                        theme === "dark" ? "bg-[#1a1d27]/40 border-[#2e3150]/60" : "bg-[#f8f9fa] border-[#ced0d4]/60"
                      }`}>
                        <p className="text-xs text-[#7a7f96] font-bold uppercase tracking-wider mb-0.5">{t("route_lbl")}</p>
                        <h4 className="font-extrabold text-brand-yellow text-md flex items-center gap-2">
                          <span>{item.startRoute}</span>
                          <span className="text-[#7a7f96] font-sans">➔</span>
                          <span>{item.endRoute}</span>
                        </h4>
                      </div>
                    )}

                    {(item.activeDays || item.excludedDays) && (
                      <div className={`p-4 rounded-xl border md:col-span-2 ${
                        theme === "dark" ? "bg-[#1a1d27]/40 border-[#2e3150]/60" : "bg-[#f8f9fa] border-[#ced0d4]/60"
                      }`}>
                        <p className="text-xs text-[#7a7f96] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-brand-yellow" />
                          <span>{language === "ta" ? "இயங்கும் நாட்கள் (Days of Operation)" : "Days of Operation"}</span>
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between mt-1">
                          <div>
                            <span className="text-[11px] text-[#7a7f96] font-bold uppercase tracking-wider block">
                              {language === "ta" ? "இயங்கும் நாட்கள்:" : "Active Days:"}
                            </span>
                            <span className="font-extrabold text-brand-yellow text-sm">
                              {item.activeDays || (language === "ta" ? "அனைத்து நாட்களும்" : "All Days")}
                            </span>
                          </div>
                          {item.excludedDays && (
                            <div className="border-t sm:border-t-0 sm:border-l border-neutral-800/10 sm:pl-4 pt-2 sm:pt-0">
                              <span className="text-[11px] text-[#7a7f96] font-bold uppercase tracking-wider block">
                                {language === "ta" ? "தவிர்க்கப்பட்ட நாட்கள்:" : "Excluded Days:"}
                              </span>
                              <span className="font-extrabold text-red-400 text-sm">
                                {item.excludedDays}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timings wrapper cards */}
                  <div className="mb-6">
                    <h3 className="font-bold text-xs uppercase tracking-widest text-[#7a7f96] mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-yellow" />
                      <span>{t("departing_timings_title")}</span>
                    </h3>

                    <div className="flex flex-wrap gap-2.5">
                      {item.timings.map((time, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center gap-2 px-4 py-2 bg-brand-yellow-light/20 text-brand-yellow border border-brand-yellow/30 rounded-xl font-bold font-sans text-sm`}
                        >
                          <span className="w-2 h-2 rounded-full bg-brand-yellow animate-pulse"></span>
                          <span>{time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GPS Embedded coordinates preview map */}
                  {item.gps ? (
                    <div className="mb-6">
                      <h3 className="font-bold text-xs uppercase tracking-widest text-[#7a7f96] mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-brand-yellow" />
                        <span>{t("interactive_map_title")}</span>
                      </h3>
                      
                      <div 
                        onClick={() => {
                          if (item.gps) {
                            // Robust GPS coordinates parser
                            const parseGPS = (gpsStr: string) => {
                              if (!gpsStr) return [];
                              const results: { lat: number; lng: number; busName?: string; departureTime?: string; crowdLevel?: "Low" | "Medium" | "High" }[] = [];
                              
                              if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(gpsStr.trim())) {
                                const parts = gpsStr.split(",").map(p => parseFloat(p.trim()));
                                return [{ lat: parts[0], lng: parts[1], busName: item.location || "Bus Stop" }];
                              }
                              
                              const segments = gpsStr.split("|");
                              for (const segment of segments) {
                                const match = segment.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
                                if (match) {
                                  const lat = parseFloat(match[1]);
                                  const lng = parseFloat(match[2]);
                                  const nameMatch = segment.match(/\(([^)]+)\)/);
                                  const busName = nameMatch ? nameMatch[1] : (item.location || "Bus Stop");
                                  const depMatch = segment.match(/\[Dep:\s*([^\]]+)\]/);
                                  const departureTime = depMatch ? depMatch[1] : undefined;
                                  results.push({ lat, lng, busName, departureTime, crowdLevel: "Medium" as const });
                                }
                              }
                              return results;
                            };

                            const parsedStops = parseGPS(item.gps);
                            if (parsedStops.length > 0) {
                              setPinCStops(parsedStops);
                              setMapStep(2); // Instantly show bus stops step
                              
                              const firstStop = parsedStops[0];
                              setPinALatLng({ lat: firstStop.lat, lng: firstStop.lng });
                              setPinASet(true);

                              if (parsedStops.length > 1) {
                                const lastStop = parsedStops[parsedStops.length - 1];
                                setPinBLatLng({ lat: lastStop.lat, lng: lastStop.lng });
                                setPinBSet(true);
                              } else {
                                setPinBLatLng({ lat: firstStop.lat + 0.005, lng: firstStop.lng + 0.005 });
                                setPinBSet(true);
                              }
                            }
                          }
                          setMapModalOpen(true);
                          triggerToast(language === "ta" ? "🎯 இன்-ஆப் மேப்பில் பாதை ஏற்றப்பட்டது!" : "🎯 Route loaded in custom in-app map!");
                        }}
                        className="relative aspect-video rounded-2xl overflow-hidden shadow-md border border-neutral-700/20 bg-neutral-900 flex items-center justify-center cursor-pointer group"
                        title={language === "ta" ? "இன்-ஆப் வரைபடத்தை திறக்க கிளிக் செய்க" : "Click to view full route in custom in-app map"}
                      >
                        {/* Embed static google map centered accurately around custom lat lng coordinates */}
                        <iframe 
                          width="100%" 
                          height="100%" 
                          style={{ border: 0, borderRadius: "14px", pointerEvents: "none" }} 
                          loading="lazy" 
                          allowFullScreen 
                          referrerPolicy="no-referrer"
                          src={`https://maps.google.com/maps?q=${mapCenterCoords || item.gps}&hl=en&z=${mapZoom}&output=embed`}
                        />
                        {/* Elegant overlay to capture clicks and prevent external redirects, while prompting the user */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex flex-col items-center justify-center">
                          <div className="bg-black/80 text-brand-yellow font-extrabold text-xs px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 flex items-center gap-2 shadow-2xl border border-brand-yellow/30">
                            <Map className="w-4 h-4 animate-bounce text-brand-yellow" />
                            <span>{language === "ta" ? "இன்-ஆப் வரைபடத்தில் காட்டு" : "VIEW ON CUSTOM IN-APP MAP"}</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          if (item.gps) {
                            // Robust GPS coordinates parser
                            const parseGPS = (gpsStr: string) => {
                              if (!gpsStr) return [];
                              const results: { lat: number; lng: number; busName?: string; departureTime?: string; crowdLevel?: "Low" | "Medium" | "High" }[] = [];
                              
                              if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(gpsStr.trim())) {
                                const parts = gpsStr.split(",").map(p => parseFloat(p.trim()));
                                return [{ lat: parts[0], lng: parts[1], busName: item.location || "Bus Stop" }];
                              }
                              
                              const segments = gpsStr.split("|");
                              for (const segment of segments) {
                                const match = segment.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
                                if (match) {
                                  const lat = parseFloat(match[1]);
                                  const lng = parseFloat(match[2]);
                                  const nameMatch = segment.match(/\(([^)]+)\)/);
                                  const busName = nameMatch ? nameMatch[1] : (item.location || "Bus Stop");
                                  const depMatch = segment.match(/\[Dep:\s*([^\]]+)\]/);
                                  const departureTime = depMatch ? depMatch[1] : undefined;
                                  results.push({ lat, lng, busName, departureTime, crowdLevel: "Medium" as const });
                                }
                              }
                              return results;
                            };

                            const parsedStops = parseGPS(item.gps);
                            if (parsedStops.length > 0) {
                              setPinCStops(parsedStops);
                              setMapStep(2); // Instantly show bus stops step
                              
                              const firstStop = parsedStops[0];
                              setPinALatLng({ lat: firstStop.lat, lng: firstStop.lng });
                              setPinASet(true);

                              if (parsedStops.length > 1) {
                                const lastStop = parsedStops[parsedStops.length - 1];
                                setPinBLatLng({ lat: lastStop.lat, lng: lastStop.lng });
                                setPinBSet(true);
                              } else {
                                setPinBLatLng({ lat: firstStop.lat + 0.005, lng: firstStop.lng + 0.005 });
                                setPinBSet(true);
                              }
                            }
                          }
                          setMapModalOpen(true);
                          triggerToast(language === "ta" ? "🎯 இன்-ஆப் மேப்பில் பாதை ஏற்றப்பட்டது!" : "🎯 Route loaded in custom in-app map!");
                        }}
                        className="mt-3 w-full py-3.5 bg-brand-yellow hover:bg-brand-yellow/90 text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-md transition-all border-none outline-none cursor-pointer"
                      >
                        <Map className="w-4 h-4" />
                        <span>{language === "ta" ? "இன்-ஆப் மேப்பில் காட்டு / மையப்படுத்து" : "CENTER & HIGHLIGHT IN-APP MAP"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className={`p-6 rounded-xl text-center border border-dashed ${
                      theme === "dark" ? "border-zinc-800 bg-zinc-900/10" : "border-zinc-300 bg-zinc-50"
                    }`}>
                      <MapPin className="w-8 h-8 mx-auto text-[#7a7f96] mb-2 opacity-50" />
                      <p className="text-xs text-[#7a7f96]">{t("no_gps_location")}</p>
                    </div>
                  )}

                  {/* Metadata banner and inline editor access */}
                  <div className={`mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
                    theme === "dark" ? "border-[#1c1f33]" : "border-[#ced0d4]"
                  }`}>
                    <div className="flex items-center gap-3">
                      <small className="text-[#7a7f96]">
                        {t("contributed_by_footer")} <b className="text-brand-yellow font-bold">@{item.addedBy}</b> {t("on_date")} {item.date}
                      </small>
                      <button
                        type="button"
                        onClick={(e) => handleOpenReportModal(item, e)}
                        className="py-1 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
                        title="Report issue with this bus stop info"
                      >
                        <Flag className="w-3.5 h-3.5 text-red-400" />
                        <span>Report Issue</span>
                      </button>
                    </div>

                    {/* Show control buttons if user belongs online */}
                    {userSession && isMatchingOwner(item.addedBy, userSession, item.id) && (
                      <div className="flex gap-2.5 w-full sm:w-auto">
                        <button 
                          onClick={() => handleEditInit(item)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 bg-lime-600 hover:bg-lime-700 text-white font-extrabold rounded-lg text-xs cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{t("edit_lbl")}</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteStop(item.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 border border-red-500/40 hover:bg-red-500/10 text-red-500 font-extrabold rounded-lg text-xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t("delete_lbl")}</span>
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW 2: ACTIVE TABS ROUTER */}
        {!selectedStopId && (
          <div className="animate-fade-in">
            
            {/* TAB-1: VIEW ALL BUS STOPS LIST */}
            {activeTab === "view" && (
              <div>
                {/* Search Box Header */}
                <div className="mb-8">
                  <h2 className="font-display font-extrabold text-xl md:text-2xl mb-2 flex items-center gap-3">
                    {t("tn_bus_timings_board")}
                  </h2>
                  <p className="text-[#7a7f96] text-xs md:text-sm">
                    {t("tn_bus_timings_desc")}
                  </p>
                </div>

                {/* Filter and Query Board */}
                <div className="flex flex-col gap-4 mb-6">
                  {/* Beautiful visual search box */}
                  <div className="relative w-full">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-brand-yellow" />
                    <input 
                      type="text"
                      className={`w-full py-4 pl-12 pr-4 text-sm font-medium rounded-xl outline-none focus:ring-2 focus:ring-brand-yellow/40 transition-shadow ${
                        theme === "dark" 
                          ? "bg-[#131622] border border-[#23273c] text-white" 
                          : "bg-white border border-[#ced0d4]/80 text-[#090b0f] shadow-sm"
                      }`}
                      placeholder={t("search_placeholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 hover:scale-105 text-[#7a7f96]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Horizontal tag categories for instant district switching */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <span className="text-xs font-bold text-[#7a7f96] mr-1 flex-shrink-0">{t("district_filter")}</span>
                    {uniqueDistricts.map((dist, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedDistrictFilter(dist)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          selectedDistrictFilter === dist 
                            ? "bg-brand-yellow text-black font-extrabold" 
                            : theme === "dark" 
                            ? "bg-zinc-800/60 text-[#7a7f96] hover:bg-zinc-800"
                            : "bg-[#e4e6eb] text-[#65676b] hover:bg-[#d8dadf]"
                        }`}
                      >
                        {dist === "All" ? t("all_regions") : dist.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid Lists Container */}
                {filteredStops.length === 0 ? (
                  <div className={`p-12 text-center rounded-2xl border border-dashed ${
                    theme === "dark" ? "border-zinc-800 bg-[#0f1117]" : "border-zinc-300 bg-zinc-50"
                  }`}>
                    <Bus className="w-12 h-12 mx-auto text-[#7a7f96] mb-3 opacity-40 animate-pulse" />
                    <h3 className="font-bold text-md mb-1">{t("no_match_title")}</h3>
                    <p className="text-xs text-[#7a7f96] max-w-sm mx-auto">
                      {t("no_match_desc")}
                    </p>
                    <a 
                      href="#add"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("add"); }}
                      className="mt-4 inline-block px-4 py-2 bg-brand-yellow text-black font-bold text-xs rounded-xl"
                    >
                      {t("add_timing_stop_btn")}
                    </a>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredStops.map((stop) => (
                      <div 
                        key={stop.id}
                        onClick={() => setSelectedStopId(stop.id)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] hover:border-brand-yellow relative overflow-hidden flex flex-col justify-between ${
                          theme === "dark" 
                            ? "bg-[#131622] border-[#1f233a] shadow-lg shadow-black/10" 
                            : "bg-white border-[#ced0d4]/80 shadow-md shadow-neutral-200/50"
                        }`}
                      >
                        {/* Absolute background accent item */}
                        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform">
                          <Bus className="w-24 h-24" />
                        </div>

                        <div>
                          {/* Title district limits */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <span className="text-[10px] text-[#7a7f96] uppercase tracking-wider font-extrabold block">{t("tn_registry_board_badge")}</span>
                              <h3 className="font-display font-extrabold text-lg group-hover:text-brand-yellow transition-colors leading-tight truncate max-w-[200px]">
                                {stop.name} · <span className="text-brand-yellow font-bold text-sm">{stop.village}</span>
                              </h3>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Like Button */}
                              <button
                                type="button"
                                onClick={(e) => toggleLike(stop.id, e)}
                                className={`p-1.5 px-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer z-10 border ${
                                  likedStops.includes(stop.id)
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                    : "border-transparent hover:bg-neutral-500/10 text-neutral-400 hover:text-amber-400"
                                }`}
                                title={likedStops.includes(stop.id) ? "Unlike" : "Like"}
                              >
                                <ThumbsUp 
                                  className={`w-3.5 h-3.5 transition-all duration-200 active:scale-125 ${
                                    likedStops.includes(stop.id) 
                                      ? "fill-amber-400 text-amber-400" 
                                      : "text-neutral-400 hover:text-amber-400"
                                  }`} 
                                />
                                {Boolean(stop.likeCount && stop.likeCount > 0) && (
                                  <span className={`text-xs font-bold ${likedStops.includes(stop.id) ? "text-amber-400" : ""}`}>
                                    {stop.likeCount}
                                  </span>
                                )}
                              </button>

                              {/* Star Icon Toggle */}
                              <button
                                type="button"
                                onClick={(e) => toggleStar(stop.id, e)}
                                className="p-1.5 rounded-full hover:bg-neutral-500/10 transition-colors cursor-pointer z-10"
                                title={starredStops.includes(stop.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                              >
                                <Star 
                                  className={`w-4 h-4 transition-all duration-200 active:scale-150 ${
                                    starredStops.includes(stop.id) 
                                      ? "fill-amber-400 text-amber-400" 
                                      : "text-neutral-400 hover:text-amber-400"
                                  }`} 
                                />
                              </button>

                              <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full ${
                                stop.route.includes("High") 
                                  ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                                  : stop.route.includes("Medium") 
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                                  : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              }`}>
                                {stop.route.includes("High") ? t("high_crowd") : stop.route.includes("Medium") ? t("medium_crowd") : t("low_crowd")}
                              </span>
                            </div>
                          </div>

                          {/* Info Rows */}
                          <div className="space-y-2 mb-4 text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <span className="text-[#7a7f96] font-bold">{t("bus_name_lbl")}</span>
                              <strong className={`${theme === "dark" ? "text-neutral-200" : "text-neutral-800"}`}>{stop.location}</strong>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#7a7f96] font-bold">{t("village_limit_lbl")}</span>
                              <span>{stop.village}</span>
                            </div>
                            {stop.startRoute && stop.endRoute && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span className="text-[#7a7f96] font-bold text-[10px] uppercase tracking-wider shrink-0">{t("route_lbl")}:</span>
                                <span className={`font-extrabold text-xs px-2 py-0.5 rounded-lg flex items-center gap-1.5 ${
                                  theme === "dark" ? "bg-amber-400/10 text-[#f8be43]" : "bg-[#f8be43]/15 text-[#a1761e]"
                                }`}>
                                  <span>{stop.startRoute}</span>
                                  <span className="text-[9px] opacity-75 font-sans">➔</span>
                                  <span>{stop.endRoute}</span>
                                </span>
                              </div>
                            )}
                            {(stop.activeDays || stop.excludedDays) && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span className="text-[#7a7f96] font-bold text-[10px] uppercase tracking-wider shrink-0">
                                  {language === "ta" ? "இயங்கும் நாட்கள்:" : "Operating Days:"}
                                </span>
                                <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-lg ${
                                  theme === "dark" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-500/5 text-emerald-600 border border-emerald-500/20"
                                }`}>
                                  {stop.activeDays || (language === "ta" ? "அனைத்து நாட்களும்" : "All Days")}
                                  {stop.excludedDays && ` (${stop.excludedDays})`}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Timing Chips Row (Show max 3 and ellipsis) */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {stop.timings.slice(0, 3).map((time, idx) => (
                              <div key={idx} className={`text-[11px] font-bold py-1 px-2.5 rounded bg-zinc-800/15 border border-transparent flex items-center gap-1 ${
                                theme === "dark" 
                                  ? "bg-[#1d2134] text-neutral-200 border-[#2b314d]" 
                                  : "bg-[#e4e6eb] text-neutral-800 border-[#ced0d4]"
                              }`}>
                                <span className="w-1.5 h-1.5 bg-brand-yellow rounded-full"></span>
                                <span>{time}</span>
                              </div>
                            ))}
                            {stop.timings.length > 3 && (
                              <div className="text-[10px] text-[#7a7f96] font-bold flex items-center px-1.5">
                                + {stop.timings.length - 3} {t("more_timings")}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card metadata details */}
                        <div className={`pt-3 border-t flex items-center justify-between text-[10px] text-[#7a7f96] group-hover:border-brand-yellow/30 transition-all ${
                          theme === "dark" ? "border-zinc-800" : "border-zinc-200"
                        }`}>
                          <span className="truncate max-w-[120px]">{t("by_contributor")} @{stop.addedBy}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleOpenReportModal(stop, e)}
                              className="p-1 px-2 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer"
                              title="Report issue with this bus stop info"
                            >
                              <Flag className="w-3 h-3 text-red-400" />
                              <span>Report</span>
                            </button>
                            <span>{stop.date}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Standard Support Contact */}
                <div className="mt-8 pt-4 border-t border-dashed border-neutral-700/20 text-center text-xs text-[#7a7f96] font-medium">
                  <span>Need immediate technical query resolutions? Contact admin support: </span>
                  <a href="mailto:p99705270@gmail.com" className="text-brand-yellow font-bold hover:underline">
                    p99705270@gmail.com
                  </a>
                </div>
              </div>
            )}

            {/* TAB: WISHLIST (FAVORITED BUS STOPS) */}
            {activeTab === "wishlist" && (() => {
              const starredList = stops.filter(s => starredStops.includes(s.id));
              return (
                <div className="animate-fade-in">
                  {/* Header */}
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={() => navigateToTab("view")}
                      className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-brand-yellow transition-all cursor-pointer border-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t("back_to_board")}</span>
                    </button>
                    <h2 className="font-display font-extrabold text-xl md:text-2xl mb-2 flex items-center gap-3">
                      <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                      {t("wishlist_title")}
                    </h2>
                    <p className="text-[#7a7f96] text-xs md:text-sm">
                      {t("wishlist_desc")}
                    </p>
                  </div>

                  {starredList.length === 0 ? (
                    <div className={`p-12 text-center rounded-2xl border border-dashed ${
                      theme === "dark" ? "border-zinc-800 bg-[#0f1117]" : "border-zinc-300 bg-zinc-50"
                    }`}>
                      <Star className="w-12 h-12 mx-auto text-[#7a7f96] mb-3 opacity-30 animate-pulse" />
                      <h3 className="font-bold text-md mb-1">{t("no_wishlist_title")}</h3>
                      <p className="text-xs text-[#7a7f96] max-w-sm mx-auto leading-relaxed mb-4">
                        {t("no_wishlist_desc")}
                      </p>
                      <button 
                        onClick={() => navigateToTab("view")}
                        className="px-4 py-2 bg-brand-yellow text-black font-bold text-xs rounded-xl cursor-pointer hover:bg-brand-yellow/95 transition-all"
                      >
                        {language === "ta" ? "🚌 முகப்பு பலகைக்குச் செல்" : "🚌 Go to Home Board"}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {starredList.map((stop) => (
                        <div 
                          key={stop.id}
                          onClick={() => setSelectedStopId(stop.id)}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] hover:border-brand-yellow relative overflow-hidden flex flex-col justify-between ${
                            theme === "dark" 
                              ? "bg-[#131622] border-[#1f233a] shadow-lg shadow-black/10" 
                              : "bg-white border-[#ced0d4]/80 shadow-md shadow-neutral-200/50"
                          }`}
                        >
                          {/* Absolute background accent item */}
                          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform">
                            <Bus className="w-24 h-24" />
                          </div>

                          <div>
                            {/* Title district limits */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <span className="text-[10px] text-[#7a7f96] uppercase tracking-wider font-extrabold block">{t("tn_registry_board_badge")}</span>
                                <h3 className="font-display font-extrabold text-lg group-hover:text-brand-yellow transition-colors leading-tight truncate max-w-[200px]">
                                  {stop.name} · <span className="text-brand-yellow font-bold text-sm">{stop.village}</span>
                                </h3>
                              </div>

                              <div className="flex items-center gap-1">
                                {/* Like Button */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleLike(stop.id, e)}
                                  className={`p-1.5 px-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer z-10 border ${
                                    likedStops.includes(stop.id)
                                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                      : "border-transparent hover:bg-neutral-500/10 text-neutral-400 hover:text-amber-400"
                                  }`}
                                  title={likedStops.includes(stop.id) ? "Unlike" : "Like"}
                                >
                                  <ThumbsUp 
                                    className={`w-3.5 h-3.5 transition-all duration-200 active:scale-125 ${
                                      likedStops.includes(stop.id) 
                                        ? "fill-amber-400 text-amber-400" 
                                        : "text-neutral-400 hover:text-amber-400"
                                    }`} 
                                  />
                                  {Boolean(stop.likeCount && stop.likeCount > 0) && (
                                    <span className={`text-xs font-bold ${likedStops.includes(stop.id) ? "text-amber-400" : ""}`}>
                                      {stop.likeCount}
                                    </span>
                                  )}
                                </button>

                                {/* Star Icon Toggle */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleStar(stop.id, e)}
                                  className="p-1.5 rounded-full hover:bg-neutral-500/10 transition-colors cursor-pointer z-10"
                                  title="Remove from Wishlist"
                                >
                                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                </button>

                                <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full ${
                                  stop.route.includes("High") 
                                    ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                                    : stop.route.includes("Medium") 
                                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                                    : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                }`}>
                                  {stop.route.includes("High") ? t("high_crowd") : stop.route.includes("Medium") ? t("medium_crowd") : t("low_crowd")}
                                </span>
                              </div>
                            </div>

                            {/* Info Rows */}
                            <div className="space-y-2 mb-4 text-xs font-medium">
                              <div className="flex items-center gap-2">
                                <span className="text-[#7a7f96] font-bold">{t("bus_name_lbl")}</span>
                                <strong className={`${theme === "dark" ? "text-neutral-200" : "text-neutral-800"}`}>{stop.location}</strong>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#7a7f96] font-bold">{t("village_limit_lbl")}</span>
                                <span>{stop.village}</span>
                              </div>
                              {stop.startRoute && stop.endRoute && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="text-[#7a7f96] font-bold text-[10px] uppercase tracking-wider shrink-0">{t("route_lbl")}:</span>
                                  <span className={`font-extrabold text-xs px-2 py-0.5 rounded-lg flex items-center gap-1.5 ${
                                    theme === "dark" ? "bg-amber-400/10 text-[#f8be43]" : "bg-[#f8be43]/15 text-[#a1761e]"
                                  }`}>
                                    <span>{stop.startRoute}</span>
                                    <span className="text-[9px] opacity-75 font-sans">➔</span>
                                    <span>{stop.endRoute}</span>
                                  </span>
                                </div>
                              )}
                              {(stop.activeDays || stop.excludedDays) && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="text-[#7a7f96] font-bold text-[10px] uppercase tracking-wider shrink-0">
                                    {language === "ta" ? "இயங்கும் நாட்கள்:" : "Operating Days:"}
                                  </span>
                                  <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-lg ${
                                    theme === "dark" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-500/5 text-emerald-600 border border-emerald-500/20"
                                  }`}>
                                    {stop.activeDays || (language === "ta" ? "அனைத்து நாட்களும்" : "All Days")}
                                    {stop.excludedDays && ` (${stop.excludedDays})`}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Timing Chips Row (Show max 3 and ellipsis) */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {stop.timings.slice(0, 3).map((time, idx) => (
                                <div key={idx} className={`text-[11px] font-bold py-1 px-2.5 rounded bg-zinc-800/15 border border-transparent flex items-center gap-1 ${
                                  theme === "dark" 
                                    ? "bg-[#1d2134] text-neutral-200 border-[#2b314d]" 
                                    : "bg-[#e4e6eb] text-neutral-800 border-[#ced0d4]"
                                }`}>
                                  <span className="w-1.5 h-1.5 bg-brand-yellow rounded-full"></span>
                                  <span>{time}</span>
                                </div>
                              ))}
                              {stop.timings.length > 3 && (
                                <div className="text-[10px] text-[#7a7f96] font-bold flex items-center px-1.5">
                                  + {stop.timings.length - 3} {t("more_timings")}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card metadata details */}
                          <div className={`pt-3 border-t flex items-center justify-between text-[10px] text-[#7a7f96] group-hover:border-brand-yellow/30 transition-all ${
                            theme === "dark" ? "border-zinc-800" : "border-zinc-200"
                          }`}>
                            <span className="truncate max-w-[120px]">{t("by_contributor")} @{stop.addedBy}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => handleOpenReportModal(stop, e)}
                                className="p-1 px-2 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer"
                                title="Report issue with this bus stop info"
                              >
                                <Flag className="w-3 h-3 text-red-400" />
                                <span>Report</span>
                              </button>
                              <span>{stop.date}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Standard Support Contact */}
                  <div className="mt-8 pt-4 border-t border-dashed border-neutral-700/20 text-center text-xs text-[#7a7f96] font-medium">
                    <span>Need immediate technical query resolutions? Contact admin support: </span>
                    <a href="mailto:p99705270@gmail.com" className="text-brand-yellow font-bold hover:underline">
                      p99705270@gmail.com
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* TAB-2: ADD OR MODIFY BUS STOP BOARD */}
            {activeTab === "add" && (
              <div className={`p-6 rounded-3xl border shadow-2xl max-w-lg mx-auto ${
                theme === "dark" ? "bg-[#0b0d16] border-neutral-800" : "bg-white border-neutral-200"
              }`}>
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => navigateToTab("view")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-brand-yellow transition-all cursor-pointer border-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t("back_to_board")}</span>
                  </button>
                </div>

                {!userSession ? (
                  <div className="text-center py-6">
                    <User className="w-12 h-12 mx-auto text-[#7a7f96] mb-3 opacity-40 animate-pulse" />
                    <h3 className="font-bold text-md mb-2">{t("login_required_add_stop")}</h3>
                    <p className="text-xs text-[#7a7f96] max-w-sm mx-auto mb-5 leading-relaxed">
                      {t("login_required_desc") || "Please login first to contribute new bus stop listings and timing sheets!"}
                    </p>
                    <a 
                      href="#login"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("login"); }}
                      className="inline-block px-6 py-3 bg-brand-yellow hover:bg-brand-yellow/90 hover:scale-[1.02] active:scale-[0.98] text-black font-extrabold text-xs rounded-xl shadow-md cursor-pointer border-none transition-all"
                    >
                      {t("login_securely_btn")}
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="mb-5 pb-4 border-b border-neutral-800/20">
                      <h2 className="font-display font-extrabold text-lg md:text-xl flex items-center gap-2">
                        {editModeId ? t("edit_bus_stop_title") : t("register_bus_stop_title")}
                      </h2>
                      <p className="text-xs text-[#7a7f96] mt-1 leading-relaxed">
                        {t("add_stop_desc")}
                      </p>
                    </div>

                    <form onSubmit={handleAddStopSubmit} className="space-y-4">
                  {/* Single-column location row */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#7a7f96] uppercase tracking-wider block">{t("district_town_lbl")}</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Karur, Trichy"
                      className={`w-full p-2.5 text-xs rounded-xl border outline-none font-semibold focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/40 ${
                        theme === "dark" ? "bg-[#141622] border-neutral-800 text-white" : "bg-neutral-50 border-neutral-200 text-[#090b0f]"
                      }`}
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>



                  {/* Start to End Route Section */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#7a7f96] uppercase tracking-wider block">
                      {t("route_start_end_lbl")}
                    </label>
                    <div className="flex items-center gap-2">
                      {/* Start Route Input Box with Suggestions */}
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          placeholder={t("route_start_placeholder")}
                          className={`w-full p-2.5 pr-8 text-xs rounded-xl border outline-none font-semibold focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/40 ${
                            theme === "dark" 
                              ? "bg-[#141622] border-neutral-800 text-white placeholder-white/25" 
                              : "bg-neutral-50 border-neutral-200 text-[#090b0f] placeholder-neutral-450"
                          }`}
                          value={formData.startRoute || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, startRoute: e.target.value }))}
                          onFocus={() => setShowStartSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowStartSuggestions(false), 200)}
                        />
                        {isStartLoading && (
                          <span className="absolute right-3 top-3.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-yellow opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-yellow"></span>
                          </span>
                        )}
                        {showStartSuggestions && (
                          <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-2xl border z-50 max-h-60 overflow-y-auto p-1.5 flex flex-col gap-1 ${
                            theme === "dark" 
                              ? "bg-[#141622] border-[#222436] text-white" 
                              : "bg-white border-neutral-200 text-[#090b0f]"
                          }`}>
                            {startSuggestions.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFormData(prev => ({ ...prev, startRoute: item.name }));
                                  setShowStartSuggestions(false);
                                }}
                                className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 select-none hover:bg-brand-yellow hover:text-black cursor-pointer`}
                              >
                                <span className="font-extrabold">{item.name}</span>
                                <span className="text-[9px] opacity-75 truncate">{item.display_name}</span>
                                {item.sub && (
                                  <span className="text-[8px] opacity-60 font-mono italic">{item.sub}</span>
                                )}
                              </button>
                            ))}
                            {startSuggestions.length === 0 && (
                              <div className="px-3 py-2 text-[10px] text-neutral-400 italic">
                                No matching hub found
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Visual Centered Separator */}
                      <span className="text-[#7a7f96] font-extrabold text-sm select-none px-0.5">—</span>

                      {/* End Route Input Box with Suggestions */}
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          placeholder={t("route_end_placeholder")}
                          className={`w-full p-2.5 pr-8 text-xs rounded-xl border outline-none font-semibold focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/40 ${
                            theme === "dark" 
                              ? "bg-[#141622] border-neutral-800 text-white placeholder-white/25" 
                              : "bg-neutral-50 border-neutral-200 text-[#090b0f] placeholder-neutral-450"
                          }`}
                          value={formData.endRoute || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, endRoute: e.target.value }))}
                          onFocus={() => setShowEndSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowEndSuggestions(false), 200)}
                        />
                        {isEndLoading && (
                          <span className="absolute right-3 top-3.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-yellow opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-yellow"></span>
                          </span>
                        )}
                        {showEndSuggestions && (
                          <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-2xl border z-50 max-h-60 overflow-y-auto p-1.5 flex flex-col gap-1 ${
                            theme === "dark" 
                              ? "bg-[#141622] border-[#222436] text-white" 
                              : "bg-white border-neutral-200 text-[#090b0f]"
                          }`}>
                            {endSuggestions.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFormData(prev => ({ ...prev, endRoute: item.name }));
                                  setShowEndSuggestions(false);
                                }}
                                className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 select-none hover:bg-brand-yellow hover:text-black cursor-pointer`}
                              >
                                <span className="font-extrabold">{item.name}</span>
                                <span className="text-[9px] opacity-75 truncate">{item.display_name}</span>
                                {item.sub && (
                                  <span className="text-[8px] opacity-60 font-mono italic">{item.sub}</span>
                                )}
                              </button>
                            ))}
                            {endSuggestions.length === 0 && (
                              <div className="px-3 py-2 text-[10px] text-neutral-400 italic">
                                No matching hub found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>



                  {/* Operating Days Section */}
                  <div className={`p-4 rounded-2xl border ${
                    theme === "dark" ? "bg-[#0f111a] border-neutral-800/60" : "bg-neutral-50/50 border-neutral-200/60"
                  } space-y-3.5`}>
                    <div className="flex items-center gap-1.5 border-b border-neutral-800/5 pb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-yellow" />
                      <span className="text-[11px] font-bold text-[#7a7f96] uppercase tracking-wider block">
                        {language === "ta" ? "பேருந்து இயங்கும் நாட்கள் விவரம்" : "Days of Operation Details"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Active Days */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#7a7f96] uppercase tracking-wider block">
                          {t("active_days_lbl")}
                        </label>
                        <input 
                          type="text"
                          required
                          placeholder={t("active_days_placeholder")}
                          className={`w-full p-2.5 text-xs rounded-xl border outline-none font-semibold focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/40 ${
                            theme === "dark" 
                              ? "bg-[#141622] border-neutral-800 text-white placeholder-white/25" 
                              : "bg-white border-neutral-200 text-[#090b0f] placeholder-neutral-400"
                          }`}
                          value={formData.activeDays}
                          onChange={(e) => setFormData(prev => ({ ...prev, activeDays: e.target.value }))}
                        />
                        {/* Quick Selection Chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {[(language === "ta" ? "அனைத்து நாட்களும்" : "All Days"), 
                            (language === "ta" ? "ஞாயிற்றுக்கிழமை மட்டும்" : "Sunday Only"), 
                            (language === "ta" ? "திங்கள் - வெள்ளி மட்டும்" : "Monday - Friday Only")
                           ].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, activeDays: option }))}
                              className={`px-2 py-1 text-[9px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                                formData.activeDays === option
                                  ? "bg-brand-yellow/20 border-brand-yellow text-brand-yellow"
                                  : theme === "dark"
                                    ? "bg-[#141622] border-neutral-850 text-neutral-400 hover:text-white"
                                    : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800"
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Excluded Days */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#7a7f96] uppercase tracking-wider block">
                          {t("excluded_days_lbl")}
                        </label>
                        <input 
                          type="text"
                          placeholder={t("excluded_days_placeholder")}
                          className={`w-full p-2.5 text-xs rounded-xl border outline-none font-semibold focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/40 ${
                            theme === "dark" 
                              ? "bg-[#141622] border-neutral-800 text-white placeholder-white/25" 
                              : "bg-white border-neutral-200 text-[#090b0f] placeholder-neutral-400"
                          }`}
                          value={formData.excludedDays}
                          onChange={(e) => setFormData(prev => ({ ...prev, excludedDays: e.target.value }))}
                        />
                        {/* Quick Selection Chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {[(language === "ta" ? "பள்ளி விடுமுறை நாட்கள் தவிர" : "Except School Holidays"), 
                            (language === "ta" ? "அரசு விடுமுறை நாட்கள் தவிர" : "Except Gov Holidays"),
                            (language === "ta" ? "ஞாயிறு தவிர" : "Except Sundays"),
                            (language === "ta" ? "இல்லை" : "None")
                           ].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, excludedDays: option === "None" || option === "இல்லை" ? "" : option }))}
                              className={`px-2 py-1 text-[9px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                                (option === "None" || option === "இல்லை" ? !formData.excludedDays : formData.excludedDays === option)
                                  ? "bg-brand-yellow/20 border-brand-yellow text-brand-yellow"
                                  : theme === "dark"
                                    ? "bg-[#141622] border-neutral-850 text-neutral-400 hover:text-white"
                                    : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800"
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>



                  {/* Clean Location Coordinates Picker Component */}
                  <div className="space-y-2 pt-2 border-t border-neutral-800/10">
                    <span className="text-[10px] font-bold text-[#7a7f96] uppercase tracking-wider block">{t("coordinates_lbl")}</span>
                    
                    {formData.gps ? (
                      <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        theme === "dark" 
                          ? "bg-[#141622] border-emerald-500/20 text-[#a3a6b5]" 
                          : "bg-emerald-500/5 border-emerald-500/20 text-[#090b0f]"
                      }`}>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-xs truncate font-mono font-bold">
                            {formData.gps}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, gps: "" }));
                            setGpsStatus("none");
                          }}
                          className="text-[10px] uppercase font-bold text-red-500 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer"
                        >
                          {t("cancel_btn")}
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => {
                          setMapStep(1);
                          setBelongsToPin(null);
                          setActivePinSelector("A");
                          setMapModalOpen(true);
                        }}
                        className="w-full py-2.5 px-4 bg-brand-yellow/10 hover:bg-brand-yellow/15 border border-dashed border-brand-yellow text-brand-yellow text-xs font-extrabold flex items-center justify-center gap-1.5 rounded-xl cursor-pointer transition-all"
                      >
                        <Map className="w-3.5 h-3.5" />
                        <span>{t("choose_map_btn")}</span>
                      </button>
                    )}
                  </div>

                  {/* Submit buttons list */}
                  <div className="pt-4 flex gap-3">
                    {editModeId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditModeId(null);
                          setIsEditing(false);
                          setFormData({
                            name: "",
                            village: "",
                            location: "",
                            startRoute: "",
                            endRoute: "",
                            route: "Medium Crowd",
                            timings: "",
                            gps: "",
                            activeDays: "All Days",
                            excludedDays: ""
                          });
                          setGpsStatus("none");
                          setActiveTab("view");
                        }}
                        className={`flex-1 py-3.5 rounded-xl font-bold text-xs cursor-pointer text-center border ${
                          theme === "dark" ? "bg-zinc-800 border-zinc-700 hover:bg-zinc-700" : "bg-zinc-200 border-zinc-300 hover:bg-zinc-300 text-zinc-800"
                        }`}
                      >
                        {t("undo_edit_btn")}
                      </button>
                    )}

                    <button 
                      type="submit"
                      className="flex-2 py-3.5 bg-brand-yellow hover:bg-brand-yellow/90 text-black font-extrabold text-sm rounded-xl shadow-lg shadow-brand-yellow/10 transition-all cursor-pointer text-center"
                    >
                      {editModeId ? t("update_board_btn") : t("save_timing_btn")}
                    </button>
                  </div>
                </form>
                </>
                )}

                {/* Standard Support Contact */}
                <div className="mt-6 pt-4 border-t border-dashed border-neutral-700/20 text-center text-xs text-[#7a7f96] font-medium">
                  <span>Need immediate technical query resolutions? Contact admin support: </span>
                  <a href="mailto:p99705270@gmail.com" className="text-brand-yellow font-bold hover:underline">
                    p99705270@gmail.com
                  </a>
                </div>
              </div>
            )}

            {/* TAB-3: OWNER CONSOLE CONTROL HUB */}
            {activeTab === "owner" && (
              <div>
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => navigateToTab("view")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-brand-yellow transition-all cursor-pointer border-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t("back_to_board")}</span>
                  </button>
                </div>

                {!userSession ? (
                  <div className={`p-10 text-center rounded-2xl border ${
                    theme === "dark" ? "bg-[#131622] border-[#1e2235]" : "bg-white border-[#ced0d4]"
                  }`}>
                    <User className="w-12 h-12 mx-auto text-[#7a7f96] mb-3 opacity-40" />
                    <h3 className="font-bold text-md mb-2">{t("login_required_hub")}</h3>
                    <p className="text-xs text-[#7a7f96] max-w-sm mx-auto mb-5 leading-relaxed">
                      {t("login_required_desc")}
                    </p>
                    <a 
                      href="#login"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); navigateToTab("login"); }}
                      className="inline-block px-6 py-3 bg-brand-yellow text-black font-bold text-xs rounded-xl shadow-md cursor-pointer border-none"
                    >
                      {t("login_securely_btn")}
                    </a>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* OWNER ACTION CONTROLS */}
                    <div className={`p-5 rounded-2xl border ${
                      theme === "dark" ? "bg-[#131622] border-[#1e2235]" : "bg-white border-[#ced0d4]"
                    }`}>
                      <h4 className="font-bold text-sm tracking-wide mb-2 flex items-center gap-1.5">
                        <span>{t("system_maintenance")}</span>
                      </h4>
                      <p className="text-xs text-[#7a7f96] mb-4">
                        {t("system_maintenance_desc")}
                      </p>
                      
                      <button 
                        onClick={handleClearAllRegistry}
                        className="py-3 px-5 border border-red-500 text-red-500 font-extrabold text-xs rounded-xl hover:bg-red-500/10 transition-colors w-full sm:w-auto bg-transparent cursor-pointer"
                      >
                        {t("clean_my_listed")}
                      </button>
                    </div>

                    {/* ENTRIES LISTS HEADER */}
                    <div>
                      <h3 className="font-display font-extrabold text-lg mb-4">
                        {t("contributions_history")}
                      </h3>

                      {stops.filter(s => isMatchingOwner(s.addedBy, userSession, s.id)).length === 0 ? (
                        <div className="text-center py-12 text-[#7a7f96] border border-dashed border-neutral-700/60 rounded-xl bg-zinc-800/5">
                          <XCircle className="w-10 h-10 mx-auto opacity-30 mb-2" />
                          <p className="text-xs">{t("no_contributions_yet")}</p>
                          <button 
                            onClick={() => navigateToTab("add")}
                            className="mt-3 px-4 py-2 bg-brand-yellow text-black font-extrabold text-xs rounded-lg shadow-sm border-none cursor-pointer"
                          >
                            {t("add_first_stop_btn")}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          {stops.filter(s => isMatchingOwner(s.addedBy, userSession, s.id)).map(stop => (
                            <div 
                              key={stop.id}
                              className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                theme === "dark" ? "bg-[#131622] border-[#22253c]" : "bg-white border-[#ced0d4]/80 shadow"
                              }`}
                            >
                              <div onClick={() => setSelectedStopId(stop.id)} className="cursor-pointer flex-1">
                                <h4 className="font-bold text-md leading-tight group-hover:text-brand-yellow">
                                  🚌 {stop.name} · <span className="text-brand-yellow font-bold text-sm">{stop.village}</span>
                                </h4>
                                <p className="text-xs text-[#7a7f96] mt-1 font-medium">
                                  {t("bus_name_lbl")} <b>{stop.location}</b> | {t("crowd_level_lbl")}: <b>{stop.route}</b>
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {stop.timings.map((timeItem, idx) => (
                                    <span key={idx} className="text-[10px] bg-zinc-800/10 text-[#7a7f96] px-2 py-0.5 rounded border border-neutral-700/20 font-bold">{timeItem}</span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0">
                                <button
                                  onClick={() => handleEditInit(stop)}
                                  className="flex-1 sm:flex-none p-2.5 rounded-lg bg-zinc-800/10 hover:bg-zinc-800/20 border border-[#2e3150]/60 text-indigo-400 font-bold flex items-center justify-center gap-1 cursor-pointer"
                                  title={t("edit_lbl")}
                                >
                                  <Edit3 className="w-4 h-4 text-brand-yellow" />
                                  <span className="text-[10px] sm:hidden">{t("edit_lbl")}</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteStop(stop.id)}
                                  className="flex-1 sm:flex-none p-2.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-500 font-bold flex items-center justify-center gap-1 cursor-pointer bg-transparent"
                                  title={t("delete_lbl")}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="text-[10px] sm:hidden">{t("delete_lbl")}</span>
                                </button>
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Developer credit note helper */}
                    <div className={`p-4 rounded-xl border border-dashed text-center font-medium ${
                      theme === "dark" ? "border-neutral-800 bg-neutral-950/20" : "border-neutral-300 bg-[#f4f6fa]/60"
                    }`}>
                      <p className="text-xs text-[#7a7f96]">{t("technical_queries")}</p>
                      <a href="mailto:p99705270@gmail.com" className="text-brand-yellow text-xs font-bold hover:underline block mt-1">
                        {t("contact_admin")} p99705270@gmail.com
                      </a>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB-4: ABOUT APP (CITIZEN SERVICES) */}
            {activeTab === "about" && (
              <div className="max-w-xl mx-auto space-y-6">
                <div className={`p-6 rounded-2xl border shadow-xl ${
                  theme === "dark" ? "bg-[#131622] border-[#22253c]" : "bg-white border-[#ced0d4]"
                }`}>
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => navigateToTab("view")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-brand-yellow transition-all cursor-pointer border-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t("back_to_board")}</span>
                    </button>
                  </div>

                  <h2 className="font-display font-extrabold text-2xl mb-4 text-brand-yellow">
                    {t("about_title")}
                  </h2>
                  
                  <div className="space-y-4 text-sm leading-relaxed text-[#7a7f96]">
                    <p>
                      {t("about_p1")}
                    </p>
                    <p>
                      {t("about_p2")}
                    </p>
                    <p>
                      {t("about_p3")}
                    </p>
                    <p>
                      {t("about_p4")}
                    </p>
                  </div>

                  <div className={`mt-6 pt-6 border-t ${
                    theme === "dark" ? "border-[#1c1f33]" : "border-[#ced0d4]"
                  }`}>
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2">{t("registry_policy")}</h3>
                    <p className="text-xs text-[#7a7f96]">
                      {t("about_footer_desc")}
                    </p>
                    <a href="mailto:p99705270@gmail.com" className="text-brand-yellow text-sm font-extrabold mt-1.5 block hover:underline">
                      📧 p99705270@gmail.com
                    </a>
                  </div>
                </div>

                {/* Aesthetic micro feature banner */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-xl text-center border ${
                    theme === "dark" ? "bg-[#131622] border-zinc-800" : "bg-white border-zinc-200"
                  }`}>
                    <small className="text-brand-yellow text-[10px] tracking-wider uppercase font-bold block mb-1">{t("interactive_map")}</small>
                    <p className="text-xs font-bold leading-tight">{t("gps_pin_point")}</p>
                  </div>
                  <div className={`p-4 rounded-xl text-center border ${
                    theme === "dark" ? "bg-[#131622] border-zinc-800" : "bg-white border-zinc-200"
                  }`}>
                    <small className="text-brand-yellow text-[10px] tracking-wider uppercase font-bold block mb-1">{t("merging_logic")}</small>
                    <p className="text-xs font-bold leading-tight">{t("no_duplication")}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB-6: APP SETTINGS */}
            {activeTab === "settings" && (
              <div className="max-w-md mx-auto space-y-6">
                <div className={`p-6 rounded-2xl border shadow-xl text-center ${
                  theme === "dark" ? "bg-[#131622] border-[#22253c]" : "bg-white border-[#ced0d4]"
                }`}>
                  {/* Settings View Header with Back to Home Board dispatcher trigger */}
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-neutral-700/20">
                    <button
                      type="button"
                      onClick={() => navigateToTab("view")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-brand-yellow transition-all cursor-pointer border-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t("back_to_board")}</span>
                    </button>
                    <h3 className="font-display font-black text-sm">{t("settings_title")}</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Language Switch Row */}
                    <div className={`p-5 rounded-xl border relative flex flex-col items-center justify-center ${
                      theme === "dark" ? "bg-[#0b0c16]/50 border-neutral-800" : "bg-neutral-50 border-neutral-200"
                    }`}>
                      <div className="text-center mb-3">
                        <p className="text-xs font-black">{t("language_lbl")}</p>
                        <p className="text-[10px] text-neutral-400 font-medium">Choose your interface language / மொழியைத் தேர்ந்தெடுக்கவும்</p>
                      </div>
                      
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto ${
                            theme === "dark" 
                              ? "bg-black/40 border-neutral-800 text-amber-400 hover:border-neutral-700" 
                              : "bg-white border-neutral-300 text-amber-500 hover:border-neutral-400"
                          }`}
                        >
                          <span>{language === "en" ? "English" : "தமிழ்"}</span>
                          <span className="text-[10px]">{isLanguageDropdownOpen ? "▲" : "▼"}</span>
                        </button>

                        {isLanguageDropdownOpen && (
                          <div className={`absolute left-1/2 -translate-x-1/2 mt-1 w-28 rounded-lg shadow-xl border z-30 overflow-hidden ${
                            theme === "dark" ? "bg-[#141624] border-neutral-800" : "bg-white border-neutral-200"
                          }`}>
                            <button
                              type="button"
                              onClick={() => {
                                handleLanguageChange("en");
                                setIsLanguageDropdownOpen(false);
                              }}
                              className={`w-full text-center px-3 py-2 text-xs font-bold transition-colors ${
                                language === "en"
                                  ? "bg-amber-400/20 text-brand-yellow font-extrabold"
                                  : theme === "dark" ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              English
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleLanguageChange("ta");
                                setIsLanguageDropdownOpen(false);
                              }}
                              className={`w-full text-center px-3 py-2 text-xs font-bold transition-colors ${
                                language === "ta"
                                  ? "bg-purple-500/20 text-purple-400 font-extrabold"
                                  : theme === "dark" ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              தமிழ்
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Standard Support Contact */}
                  <div className="mt-6 pt-4 border-t border-dashed border-neutral-700/20 text-center text-xs text-[#7a7f96] font-medium">
                    <span>Need immediate technical query resolutions? Contact admin support: </span>
                    <a href="mailto:p99705270@gmail.com" className="text-brand-yellow font-bold hover:underline">
                      p99705270@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB-5: AUTH CONTROL PORTAL */}
            {activeTab === "login" && (
              <div className="max-w-md mx-auto">
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => navigateToTab("view")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-brand-yellow transition-all cursor-pointer border-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t("back_to_board")}</span>
                  </button>
                </div>

                {userSession ? (
                  // Logged in profile view
                  <div className={`p-6 rounded-2xl border shadow-xl text-center ${
                    theme === "dark" ? "bg-[#131622] border-[#22253c]" : "bg-white border-[#ced0d4]"
                  }`}>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-yellow to-orange-500 text-black flex items-center justify-center font-bold text-2xl mx-auto mb-4 shadow-md">
                      {userSession.name.slice(0, 2).toUpperCase()}
                    </div>
                    
                    <h3 className="font-display font-extrabold text-xl mb-1">{userSession.name}</h3>
                    <p className="text-xs text-[#7a7f96] mb-2">@{userSession.username}</p>
                    
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-xs mb-6">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>{t("verified_contributor")}</span>
                    </div>

                    <div className="space-y-2">
                       <button 
                        onClick={() => navigateToTab("view")}
                        className="w-full py-3.5 bg-brand-yellow hover:bg-brand-yellow/90 text-black font-extrabold rounded-xl shadow-md text-sm transition-transform cursor-pointer border-none"
                      >
                        {t("go_to_bus_boards")}
                      </button>

                      <button 
                        onClick={handleLogout}
                        className="w-full py-3 px-4 border border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold rounded-xl text-xs transition-colors cursor-pointer bg-transparent"
                      >
                        {t("sign_out_securely")}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Sign-in Form
                  <div className={`p-8 rounded-3xl border shadow-2xl relative overflow-hidden transition-all duration-300 ${
                    theme === "dark" 
                      ? "bg-[#0b0c16]/95 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] border-neutral-700/60 shadow-black/80" 
                      : "bg-white border-[#ced0d4]"
                  }`}>
                    {/* Reset Password Overlay Modal */}
                    {showResetModal && (
                      <div className={`absolute inset-0 flex flex-col justify-center p-8 z-10 transition-all ${
                        theme === "dark" 
                          ? "bg-[#0b0c16] bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" 
                          : "bg-white"
                      }`}>
                        <div className="flex flex-col items-center justify-center pb-5">
                          <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center mb-3 shadow-xl ${
                            theme === "dark" ? "border-amber-400 text-amber-400" : "border-amber-500 text-amber-600"
                          }`}>
                            <Lock className="w-8 h-8 stroke-[1.2]" />
                          </div>
                          <h2 className={`font-sans font-black text-xs md:text-sm tracking-[0.2em] uppercase text-center select-none ${
                            theme === "dark" ? "text-white" : "text-neutral-800"
                          }`}>
                            {t("forgot_password")}
                          </h2>
                          <p className={`text-[11px] text-center mt-2 max-w-xs leading-relaxed ${
                            theme === "dark" ? "text-neutral-400" : "text-[#7a7f96]"
                          }`}>
                            {t("enter_email_reset")}
                          </p>
                        </div>

                        <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                          <div className={`border rounded-full flex items-center px-2 py-1.5 transition-all ${
                            theme === "dark" 
                              ? "border-white/60 focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 bg-black/35" 
                              : "border-neutral-300 focus-within:border-neutral-800 focus-within:ring-1 focus-within:ring-neutral-200 bg-neutral-50"
                          }`}>
                            <div className={`flex items-center justify-center border rounded-full h-8 w-8 shrink-0 ${
                              theme === "dark" ? "border-white/80 text-white" : "border-neutral-400 text-neutral-700"
                            }`}>
                              <User className="w-4 h-4" />
                            </div>
                            <input 
                              type="email"
                              placeholder={t("email_address")}
                              required
                              className={`w-full bg-transparent border-none outline-none font-semibold text-xs md:text-sm pl-3 pr-4 py-1- ${
                                theme === "dark" ? "text-white placeholder-white/40" : "text-neutral-800 placeholder-neutral-400"
                              }`}
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                            />
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button 
                              type="button"
                              onClick={() => {
                                setShowResetModal(false);
                                setResetEmail("");
                                setAuthError("");
                                setAuthSuccess("");
                              }}
                              className={`flex-1 py-3 border rounded-full font-bold text-[10px] uppercase tracking-wider transition-all hover:bg-white/5 active:scale-95 cursor-pointer ${
                                theme === "dark" 
                                  ? "border-white/30 hover:border-white text-white" 
                                  : "border-neutral-300 hover:border-neutral-800 text-neutral-800 bg-neutral-50"
                              }`}
                            >
                              {t("cancel_btn")}
                            </button>
                            <button 
                              type="submit"
                              disabled={resetLoading}
                              className="flex-grow py-3 bg-[#f8be43] hover:bg-[#e0ab37] active:scale-[0.98] text-black font-extrabold text-[10px] tracking-wider uppercase rounded-full transition-all shadow-xl block text-center cursor-pointer border-none font-sans disabled:opacity-50"
                            >
                              {resetLoading ? t("sending_link") : t("send_link")}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Aesthetic User Avatar Header */}
                    <div className="flex flex-col items-center justify-center pt-2 pb-6">
                      <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4 shadow-xl ${
                        theme === "dark" ? "border-white text-white" : "border-neutral-800 text-neutral-800"
                      }`}>
                        <User className="w-10 h-10 stroke-[1.2]" />
                      </div>
                      <h2 className={`font-sans font-black text-sm md:text-md tracking-[0.2em] uppercase text-center select-none ${
                        theme === "dark" ? "text-white" : "text-neutral-800"
                      }`}>
                        {authMode === "login" ? t("member_login") : t("member_registration")}
                      </h2>
                    </div>

                    {authError && (
                      <div className="p-3 bg-red-500/12 border border-red-500/35 text-red-400 font-bold rounded-xl text-xs mb-4 text-center">
                        {authError}
                      </div>
                    )}

                    {authSuccess && (
                      <div className="p-3 bg-emerald-500/12 border border-emerald-500/35 text-emerald-400 font-bold rounded-xl text-xs mb-4 text-center animate-pulse">
                        {authSuccess}
                      </div>
                    )}

                    <form onSubmit={handleAuthenticationAction} className="space-y-4">
                      {/* Name (Visible on Registration only) */}
                      {authMode === "register" && (
                        <div className={`border rounded-full flex items-center px-2 py-1.5 transition-all ${
                          theme === "dark" 
                            ? "border-white/60 focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 bg-black/35" 
                            : "border-neutral-300 focus-within:border-neutral-800 focus-within:ring-1 focus-within:ring-neutral-200 bg-neutral-50"
                        }`}>
                          <div className={`flex items-center justify-center border rounded-full h-8 w-8 shrink-0 ${
                            theme === "dark" ? "border-white/80 text-white" : "border-neutral-400 text-neutral-700"
                          }`}>
                            <User className="w-4 h-4" />
                          </div>
                          <input 
                            type="text"
                            placeholder={t("full_name")}
                            required
                            className={`w-full bg-transparent border-none outline-none font-semibold text-xs md:text-sm pl-3 pr-4 py-1 ${
                              theme === "dark" ? "text-white placeholder-white/40" : "text-neutral-800 placeholder-neutral-400"
                            }`}
                            value={authForm.name}
                            onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                      )}

                      {/* Username/Email */}
                      <div className={`border rounded-full flex items-center px-2 py-1.5 transition-all ${
                        theme === "dark" 
                          ? "border-white/60 focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 bg-black/35" 
                          : "border-neutral-300 focus-within:border-neutral-800 focus-within:ring-1 focus-within:ring-neutral-200 bg-neutral-50"
                      }`}>
                        <div className={`flex items-center justify-center border rounded-full h-8 w-8 shrink-0 ${
                          theme === "dark" ? "border-white/80 text-white" : "border-neutral-400 text-neutral-700"
                        }`}>
                          <User className="w-4 h-4" />
                        </div>
                        <input 
                          type="email"
                          placeholder={t("username")}
                          required
                          className={`w-full bg-transparent border-none outline-none font-semibold text-xs md:text-sm pl-3 pr-4 py-1 ${
                            theme === "dark" ? "text-white placeholder-white/40" : "text-neutral-800 placeholder-neutral-400"
                          }`}
                          value={authForm.email}
                          onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>

                      {/* Password */}
                      <div className={`border rounded-full flex items-center px-2 py-1.5 transition-all ${
                        theme === "dark" 
                          ? "border-white/60 focus-within:border-white focus-within:ring-1 focus-within:ring-white/20 bg-black/35" 
                          : "border-neutral-300 focus-within:border-neutral-800 focus-within:ring-1 focus-within:ring-neutral-200 bg-neutral-50"
                      }`}>
                        <div className={`flex items-center justify-center border rounded-full h-8 w-8 shrink-0 ${
                          theme === "dark" ? "border-white/80 text-white" : "border-neutral-400 text-neutral-700"
                        }`}>
                          <Lock className="w-4 h-4" />
                        </div>
                        <input 
                          type={showPassword ? "text" : "password"}
                          placeholder={t("password_lbl")}
                          required
                          className={`w-full bg-transparent border-none outline-none font-semibold text-xs md:text-sm pl-3 pr-4 py-1 ${
                            theme === "dark" ? "text-white placeholder-white/40" : "text-neutral-800 placeholder-neutral-400"
                          }`}
                          value={authForm.password}
                          onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>

                      {/* Show Password / Forgot password links */}
                      <div className={`flex items-center justify-between text-[11px] font-medium px-2 mt-2 ${
                        theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                      }`}>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            className={`rounded bg-transparent focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ${
                              theme === "dark" ? "border-white/40 text-amber-400 font-extrabold" : "border-neutral-300 text-amber-500 font-bold"
                            }`} 
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                          />
                          <span>{t("show_password")}</span>
                        </label>
                        <button 
                          type="button" 
                          onClick={() => {
                            setShowResetModal(true);
                            setAuthError("");
                            setAuthSuccess("");
                          }} 
                          className={`hover:underline transition-colors cursor-pointer ${
                            theme === "dark" ? "hover:text-white" : "hover:text-black"
                          }`}
                        >
                          {t("forgot_password")}
                        </button>
                      </div>

                      {/* Submit Pill Button */}
                      <button 
                        type="submit"
                        className="w-full py-3.5 bg-[#f8be43] hover:bg-[#e0ab37] active:scale-[0.98] text-black font-extrabold text-xs tracking-wider uppercase rounded-full transition-all shadow-xl block text-center cursor-pointer mt-6 font-sans border-none"
                      >
                        {authMode === "login" ? t("login_btn") : t("register_btn")}
                      </button>
                    </form>

                    {/* Google Contrib single sign-on option */}
                    <div className="flex items-center gap-2.5 my-4 text-[10px] text-neutral-500 font-bold uppercase tracking-wider select-none justify-center">
                      <hr className="flex-1 opacity-20" />
                      <span>OR</span>
                      <hr className="flex-1 opacity-20" />
                    </div>

                    <button 
                      type="button"
                      onClick={handleGoogleSingleSignOn}
                      className={`w-full py-2.5 rounded-full border font-bold text-[10px] uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        theme === "dark" 
                          ? "border-white/30 bg-black/20 hover:border-white text-white" 
                          : "border-neutral-300 bg-[#f8f9fa] hover:bg-[#e4e6eb] text-neutral-800"
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>{t("sign_in_google")}</span>
                    </button>





                    {/* Bottom switcher action capsule */}
                    <div className="text-center pt-6 space-y-2 border-t border-white/5 mt-6">
                      <p className={`text-[10px] font-bold select-none uppercase tracking-widest ${
                        theme === "dark" ? "text-neutral-400" : "text-neutral-500"
                      }`}>
                        {authMode === "login" ? t("not_a_member") : t("already_a_member")}
                      </p>
                      <button 
                        type="button"
                        onClick={() => {
                          setAuthMode(authMode === "login" ? "register" : "login");
                          setAuthError("");
                          setAuthSuccess("");
                          setShowPassword(false);
                        }}
                        className={`px-8 py-2.5 border rounded-full font-bold text-[10px] uppercase tracking-wider transition-all hover:bg-white/5 active:scale-95 cursor-pointer ${
                          theme === "dark" 
                            ? "border-white/30 hover:border-white text-white" 
                            : "border-neutral-300 hover:border-neutral-800 text-neutral-800 bg-neutral-50 hover:bg-neutral-100"
                        }`}
                      >
                        {authMode === "login" ? t("create_account") : t("login_btn")}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </main>

      {/* ── INTERACTIVE LEAFLET ROAD MAP PICKER MODAL ── */}
      {mapModalOpen && (
        <div className="fixed inset-0 z-[2000] flex flex-col bg-[#05060a]">
          {/* Header */}
          <div className={`p-5 border-b flex items-center justify-between ${
            theme === "dark" ? "bg-[#0c0d14] border-neutral-800" : "bg-white border-neutral-300"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h3 className="font-display font-extrabold text-sm md:text-md">
                Pin Route Coords & Bus Stops (Point-to-Point)
              </h3>
            </div>
            
            <button 
              onClick={() => setMapModalOpen(false)}
              className="text-red-500 font-extrabold text-lg p-2 hover:scale-105 active:scale-95"
            >
              ✕
            </button>
          </div>

          {/* Leaflet map div container with relative layout to overlay search bar */}
          <div className="relative flex-grow w-full min-h-[350px]">
            {/* The actually rendered Leaflet element */}
            <div id="reactMapPicker" className="h-full w-full" />

            {/* Real-time GPS Error Instructions Overlay */}
            {gpsErrorDetails && (
              <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-[2001] flex items-center justify-center p-5 pointer-events-auto transition-all animate-fade-in">
                <div className={`max-w-md w-full p-6 rounded-3xl shadow-2xl border text-center transition-all ${
                  theme === "dark" ? "bg-[#0b0c16] border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
                }`}>
                  <span className="text-4xl mb-3 block">🛰️</span>
                  <h4 className="font-display font-black text-sm md:text-base mb-3 text-amber-500">
                    {gpsErrorDetails.split('\n\n')[0]}
                  </h4>
                  <div className="text-[11px] md:text-xs leading-relaxed text-left opacity-90 font-bold mb-5 whitespace-pre-line max-h-48 overflow-y-auto pr-1">
                    {gpsErrorDetails.split('\n\n')[1]}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setGpsErrorDetails(null)}
                      className="w-full py-2.5 bg-brand-yellow text-neutral-950 font-black rounded-xl shadow-md hover:scale-[1.01] active:scale-[0.99] transition-transform text-[11px] uppercase tracking-wide"
                    >
                      {language === "ta" ? "சரி, புரிந்தது (கைமுறையாக தேர்வு செய்கிறேன்)" : "OK, I'll Pin Manually"}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setGpsErrorDetails(null);
                        handleManualLocationRefresh();
                      }}
                      className={`w-full py-2 bg-transparent hover:bg-neutral-500/10 font-bold rounded-xl text-[11px] border transition-colors ${
                        theme === "dark" ? "border-neutral-700 text-white" : "border-neutral-300 text-black"
                      }`}
                    >
                      🔄 {language === "ta" ? "மீண்டும் முயற்சி செய்" : "Try Again"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time GPS Accuracy Warning Banner */}
            {lowAccuracyWarning && (
              <div className={`absolute left-4 right-4 md:left-[20%] md:right-[20%] lg:left-[30%] lg:right-[30%] z-[1050] pointer-events-auto transition-all ${
                canEditStops ? "top-20" : "top-4"
              }`}>
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-black text-xs md:text-sm p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-amber-400 backdrop-blur-md transition-all animate-pulse">
                  <span className="text-lg md:text-xl shrink-0">⚠️</span>
                  <div className="flex-grow text-left leading-tight">
                    <p className="font-extrabold text-neutral-950">
                      {language === "ta" ? "குறைந்த ஜிபிஎஸ் துல்லியம்: திறந்தவெளிக்குச் செல்லவும்" : "Low GPS Accuracy: Please move to an open area"}
                    </p>
                    <p className="text-[10px] opacity-80 font-bold mt-0.5">
                      {language === "ta" ? "சிறந்த சிக்னலுக்காக கட்டடங்களுக்கு வெளியே செல்ல முயற்சிக்கவும்." : "Try stepping outside buildings for better satellite locking."}
                    </p>
                  </div>
                </div>
              </div>
            )}

             {/* Overlaid Search Bar inside map at the top center */}
            {canEditStops && (
              <div className="absolute top-4 left-4 right-4 md:left-[15%] md:right-[15%] lg:left-[25%] lg:right-[25%] z-[1000] flex flex-col gap-2 pointer-events-auto">
                
                {/* The Search input */}
                <div className={`flex items-center gap-2.5 p-3 rounded-2xl border shadow-2xl backdrop-blur-md ${
                  theme === "dark" ? "bg-[#0b0c16]/90 border-neutral-700 text-white" : "bg-white/90 border-neutral-300 text-black"
                }`}>
                  <Search className="w-5 h-5 text-[#8a91b4] shrink-0" />
                  <input
                    type="text"
                    placeholder={mapStep === 2 ? "🔍 Search & locate exact Bus Stop on Map..." : `🔍 Search & locate ${activePinSelector === "A" ? "Start" : "End"} destination...`}
                    value={mapSearchText}
                    onChange={(e) => {
                      setMapSearchText(e.target.value);
                      handleSearchMapQueryChange(e.target.value);
                    }}
                    className="w-full bg-transparent border-none outline-none font-bold text-xs md:text-sm placeholder-[#72789c]"
                  />
                  {mapSearchText && (
                    <button 
                       onClick={() => {
                        setMapSearchText("");
                        setMapSearchSuggestions([]);
                      }} 
                      className="p-1.5 hover:bg-neutral-500/20 rounded-full transition-colors shrink-0"
                    >
                      <X className="w-4 h-4 text-neutral-400" />
                    </button>
                  )}
                </div>

                {/* Related search suggestions popup */}
                {mapSearchSuggestions.length > 0 && (
                  <div className={`max-h-64 overflow-y-auto rounded-2xl border shadow-2xl p-2 flex flex-col gap-1.5 z-[1001] ${
                    theme === "dark" ? "bg-[#0d0f19] border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
                  }`}>
                    <p className="text-[10px] uppercase font-bold text-brand-yellow px-2 pb-1 border-b border-neutral-800/20 tracking-wider">
                      Move {mapStep === 2 ? "Bus Stop" : (activePinSelector === "A" ? "Start Location" : "End Location")} To:
                    </p>
                    {mapSearchSuggestions.map((item, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectMapSuggestion(item)}
                        className="w-full text-left py-2 px-3 hover:bg-brand-yellow hover:text-black rounded-xl transition-all flex items-start gap-3 text-xs font-semibold cursor-pointer"
                      >
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="flex-1 truncate text-left">
                          <p className="font-extrabold truncate">{item.name}</p>
                          <p className="text-[10px] opacity-80 truncate">{item.display_name}</p>
                          {item.sub && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] bg-neutral-800/10 font-bold border border-neutral-500/10">
                              {item.sub}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}



            {/* On-Demand Geolocation Refresh Button */}
            <div className="absolute bottom-[136px] md:bottom-[152px] right-4 z-[1001] pointer-events-auto">
              <button
                type="button"
                onClick={handleManualLocationRefresh}
                className="p-3 bg-[#0c0d14] hover:bg-[#151724] active:scale-95 text-white rounded-full shadow-2xl transition-all cursor-pointer border border-neutral-800 flex items-center justify-center group"
                title={language === "ta" ? "இருப்பிடத்தைப் புதுப்பி" : "Refresh Current Location"}
              >
                <RefreshCw className="w-5.5 h-5.5 text-white group-hover:rotate-180 transition-transform duration-500" />
              </button>
            </div>

            {/* Crisp Floating Location Target Button (Google Maps Style) */}
            <div className="absolute bottom-[84px] md:bottom-[96px] right-4 z-[1001] pointer-events-auto">
              <button
                type="button"
                onClick={handleSeeWhereYouAre}
                className="p-3 bg-[#0c0d14] hover:bg-[#151724] active:scale-95 text-white rounded-full shadow-2xl transition-all cursor-pointer border border-neutral-800 flex items-center justify-center group"
                title={language === "ta" ? "என் தற்போதைய இருப்பிடம்" : "My Current Location"}
              >
                <Locate className="w-5.5 h-5.5 text-white group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Quick Map Satellite Mode Toggle Floating overlay with Step 1 Save option to its left */}
            <div className="absolute bottom-4 right-2 md:right-4 z-[1000] flex flex-wrap items-center justify-end gap-2 max-w-[calc(100%-20px)] pointer-events-auto">
              {mapStep === 1 && pinASet && pinBSet && (
                <button
                  type="button"
                  onClick={() => {
                    setMapStep(2);
                    setActivePinSelector("BUS");
                    triggerToast("👉 Locations Saved! Next: Place Bus Stops along the blue route.");
                  }}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.03] active:scale-[0.98] text-white rounded-2xl shadow-2xl font-black text-xs flex items-center gap-2 transition-transform cursor-pointer border border-emerald-500 animate-pulse"
                >
                  <span>✅</span>
                  <span>SAVE</span>
                </button>
              )}
              {mapStep === 2 && isBetweenPoints(busStopLatLng, pinALatLng, pinBLatLng) && (
                <button
                  type="button"
                  onClick={handleSaveMapCoordinates}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.03] active:scale-[0.98] text-white rounded-2xl shadow-2xl font-black text-xs flex items-center gap-2 transition-transform cursor-pointer border border-[#10b981] animate-bounce"
                >
                  <span>✅</span>
                  <span>SAVE</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleMapTileMode}
                className="p-3 bg-brand-yellow hover:scale-[1.03] active:scale-[0.98] text-black rounded-2xl shadow-2xl font-extrabold text-xs flex items-center gap-2 transition-transform cursor-pointer border border-[#f5b041]"
              >
                <span>🗺️</span>
                <span>{isSatelliteMode ? "Standard Street Map" : "Satellite Photo Map & Labels"}</span>
              </button>
            </div>

            {/* Public preview overlay card when editing is disabled */}
            {!canEditStops && (
              <div className="absolute bottom-4 left-1.5 md:left-2 z-[1000] flex flex-col items-start gap-2 max-w-[260px] md:max-w-xs pointer-events-auto">
                <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3 md:p-4 shadow-2xl text-left w-full space-y-2 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] tracking-wider font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                      🚍 Active Route Preview
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 font-extrabold leading-relaxed">
                    {language === "ta" ? `${pinCStops.length} பேருந்து நிறுத்தங்கள் இணைக்கப்பட்டுள்ளன` : `${pinCStops.length} Bus Stop(s) registered on this route.`}
                  </p>
                  <p className="text-[9px] text-neutral-500 font-bold leading-normal">
                    {language === "ta" ? "விவரங்களைக் காண வரைபடத்தில் உள்ள நிறுத்தங்களை அழுத்தவும்." : "Click on any bus stop pin to view departure schedules & crowd levels."}
                  </p>
                </div>
              </div>
            )}

            {/* Step 1 Instruction Details Container - Bottom-Left of Map */}
            {canEditStops && mapStep === 1 && (
              <div className="absolute bottom-4 left-4 z-[1000] flex flex-col items-start gap-2 max-w-sm md:max-w-md pointer-events-auto">
                {bottomPanelCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setBottomPanelCollapsed(false)}
                    className="w-12 h-12 rounded-2xl bg-zinc-950/95 hover:bg-neutral-900 border border-neutral-700/80 shadow-2xl text-white flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Expand Step 1 Instructions"
                  >
                    <span className="text-xl font-black">▲</span>
                    <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">INFO</span>
                  </button>
                ) : (
                  <div className="bg-zinc-950/95 border border-zinc-800 rounded-3xl p-5 shadow-2xl text-left w-full space-y-4 animate-[slide-up_0.2s_ease-out] backdrop-blur-md max-h-[350px] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="animate-pulse flex h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                        <span className="text-[10px] tracking-widest font-black uppercase text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                          🔵 STEP 1 OUT OF 2: ROUTE EXTREMES
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBottomPanelCollapsed(true)}
                        className="text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 w-7 h-7 rounded-xl flex items-center justify-center font-black text-sm transition-transform hover:scale-105 active:scale-95"
                        title="Collapse panel"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 Instruction Details Container - Bottom-Left of Map */}
            {canEditStops && mapStep === 2 && (
              <div className="absolute bottom-4 left-4 z-[1000] flex flex-col items-start gap-2 max-w-sm md:max-w-md pointer-events-auto">
                {!isStopPanelExpanded ? (
                  <button
                    type="button"
                    onClick={() => setIsStopPanelExpanded(true)}
                    className="w-12 h-12 rounded-2xl bg-zinc-950/95 hover:bg-neutral-900 border border-neutral-700/80 shadow-2xl text-white flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Expand Step 2 Instructions"
                  >
                    <span className="text-xl font-black">▲</span>
                    <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">INFO</span>
                  </button>
                ) : (
                  <div className="bg-zinc-950/95 border border-zinc-800 rounded-3xl p-5 shadow-2xl text-left w-full space-y-4 animate-[slide-up_0.2s_ease-out] backdrop-blur-md max-h-[280px] overflow-y-auto md:max-h-[380px]">
                    <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="animate-pulse flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
                        <span className="text-[10px] tracking-widest font-black uppercase text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
                          🔴 STEP 2 OUT OF 2: BUS STOP PLACEMENT
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsStopPanelExpanded(false)}
                        className="text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 w-7 h-7 rounded-xl flex items-center justify-center font-black text-sm transition-transform hover:scale-105 active:scale-95"
                        title="Collapse instructions"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="space-y-1.5 border-b border-zinc-800/40 pb-2.5">
                      <h4 className="font-display font-black text-xs text-neutral-200">
                        Where on this route is the exact bus stop located? Place the Bus Stop pin!
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-bold leading-relaxed">
                        (The bus stops must be positioned within the active route corridor segment range)
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className={`p-3.5 rounded-2xl border flex flex-col gap-3 shadow-xl ${
                        (pinCStops.length > 0 && pinCStops.every(p => isBetweenPoints(p, pinALatLng, pinBLatLng))) 
                          ? 'border-emerald-500/20 bg-emerald-600/10 text-emerald-400' 
                          : 'border-orange-500/30 bg-orange-600/10 text-orange-400'
                      }`}>
                        <div className="space-y-1">
                          <span className="font-extrabold text-[9px] tracking-wider uppercase block">
                            🔴 Placed Bus Stop Coordinates:
                          </span>
                          <div className="max-h-24 overflow-y-auto space-y-1.5 mt-1.5 pr-1 text-[11px] custom-scrollbar">
                            {pinCStops.length === 0 ? (
                              <p className="italic text-neutral-400 text-[10px]">No bus stops placed yet. Click on the map route line to place one.</p>
                            ) : (
                              pinCStops.map((p, idx) => {
                                const inRange = isBetweenPoints(p, pinALatLng, pinBLatLng);
                                return (
                                  <div key={idx} className="flex justify-between items-center text-neutral-300 font-mono py-1 border-b border-white/[0.04] last:border-b-0">
                                    <span>Stop {idx + 1}: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={inRange ? "text-emerald-400 font-bold" : "text-orange-400 font-bold"}>
                                        {inRange ? "✓" : "⚠"}
                                      </span>
                                      <button
                                        type="button"
                                        className="text-red-400 hover:text-red-500 font-black px-1.5 py-0.5 rounded hover:bg-neutral-800/10"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          const updated = pinCStops.filter((_, i) => i !== idx);
                                          setPinCStops(updated);
                                          syncStopsToRegistry(updated);
                                          if (updated.length > 0) {
                                            setBusStopLatLng(updated[0]);
                                            setActiveStopPopupIdx(0);
                                          } else {
                                            setBusPinSet(false);
                                            setActiveStopPopupIdx(null);
                                          }
                                          triggerToast(`✕ Removed Bus Stop ${idx + 1}`);
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="text-[9px] opacity-90 mt-1.5 font-semibold font-sans">
                            {(pinCStops.length > 0 && pinCStops.every(p => isBetweenPoints(p, pinALatLng, pinBLatLng))) 
                              ? "🎯 Bus Stop positioned inside selection range!" 
                              : "⚠️ Bus Stop is currently outside the segment bounds."
                            }
                          </div>
                        </div>

                        {!(pinCStops.length > 0 && pinCStops.every(p => isBetweenPoints(p, pinALatLng, pinBLatLng))) && (
                          <button
                            type="button"
                            onClick={() => {
                              const midLat = (pinALatLng.lat + pinBLatLng.lat) / 2;
                              const midLng = (pinALatLng.lng + pinBLatLng.lng) / 2;
                              const firstStop = { lat: midLat, lng: midLng };
                              const snappedFirst = snapToRoute(firstStop);
                              setPinCStops([snappedFirst]);
                              setBusStopLatLng(snappedFirst);
                              setBusPinSet(true);
                              setActiveStopPopupIdx(0);
                              syncStopsToRegistry([snappedFirst]);
                              if (pickerMapInstance) {
                                pickerMapInstance.setView([snappedFirst.lat, snappedFirst.lng], 14);
                              }
                              triggerToast("🪄 Re-centered Bus Stop at segment midpoint!");
                            }}
                            className="py-2 px-3 bg-[#e2f155] text-black font-extrabold text-[9.5px] uppercase rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-center self-start"
                          >
                            🪄 Reset to Midpoint
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls & Question Footer */}
          <div className={`p-4 border-t flex flex-col justify-center transition-all duration-300 shrink-0 select-none h-[85px] min-h-[85px] max-h-[85px] overflow-hidden ${
            theme === "dark" ? "bg-[#090a0f] border-neutral-800" : "bg-neutral-50 border-neutral-300"
          }`}>
            {!canEditStops ? (
              <div className="flex flex-row items-center justify-between w-full h-full select-none gap-3">
                <span className="text-[10px] md:text-xs font-black text-brand-yellow uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-brand-yellow animate-pulse shrink-0" />
                  {language === "ta" ? "📢 வரைபடம் (பார்வை மட்டும்)" : "📢 READ-ONLY ROUTE PREVIEW"}
                </span>
                <button 
                  type="button"
                  onClick={() => setMapModalOpen(false)}
                  className="px-6 py-3 rounded-xl font-bold text-xs uppercase cursor-pointer bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-md hover:scale-[1.01] transition-all"
                >
                  {language === "ta" ? "வரைபடத்தை மூடு" : "CLOSE MAP PREVIEW"}
                </button>
              </div>
            ) : mapStep === 1 ? (
              /* --- STEP 1: SELECT ORIGINAL STOPS & PIN BOTH --- */
              <div className="flex flex-col justify-center h-full">
                <div className="flex flex-row gap-3 justify-between items-center w-full">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBottomPanelCollapsed(prev => !prev)}
                      className={`p-3 rounded-xl border font-black text-xs cursor-pointer flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                        theme === "dark" 
                          ? "bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800" 
                          : "bg-zinc-200 border-zinc-300 text-zinc-850 hover:bg-zinc-300"
                      }`}
                      title={bottomPanelCollapsed ? "Expand panel" : "Collapse panel"}
                    >
                      {bottomPanelCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button 
                      type="button"
                      onClick={() => setMapModalOpen(false)}
                      className="px-5 py-3 rounded-xl font-bold text-xs uppercase cursor-pointer bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-md hover:scale-[1.01] transition-all"
                    >
                      CANCEL
                    </button>
                  </div>

                  {pinASet && pinBSet ? (
                    <button 
                      type="button"
                      onClick={() => {
                        setMapStep(2);
                        setActivePinSelector("BUS");
                        triggerToast("👉 Locations Saved! Next: Place Bus Stops along the blue route.");
                      }}
                      className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl cursor-pointer shadow-lg hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 border border-emerald-500"
                    >
                      <span>✅ SAVE</span>
                    </button>
                  ) : (
                    <div className="px-3 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-extrabold text-center">
                      ⚠️ Drop both pins to proceed
                    </div>
                  )}
                </div>
              </div>
            ) : (() => {
              const isBusPinInRange = pinCStops.length > 0 && pinCStops.every(p => isBetweenPoints(p, pinALatLng, pinBLatLng));
              return (
                /* --- STEP 2: ACTION BUTTONS ALWAYS VISIBLE UNDER THE MAP --- */
                <div className="flex flex-row items-center justify-between h-full w-full select-none gap-3">
                  <button 
                    type="button"
                    onClick={() => setMapModalOpen(false)}
                    className="px-5 py-3 rounded-xl font-bold text-xs uppercase cursor-pointer bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-md hover:scale-[1.01] transition-all"
                  >
                    CANCEL
                  </button>

                  <div className="flex gap-2.5 items-center shrink-0">
                    {isBusPinInRange ? (
                      <button 
                        type="button"
                        onClick={handleSaveMapCoordinates}
                        className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl cursor-pointer shadow-lg hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 border border-emerald-500"
                      >
                        <span>✅ SAVE</span>
                      </button>
                    ) : (
                      <div className="px-3 py-2.5 rounded-xl bg-orange-600/10 border border-orange-500/30 text-orange-400 text-[10px] font-extrabold text-center animate-pulse">
                        ⚠️ Place inside range to save
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            </div>




            {/* Full-screen bottom sheet instructions overlay */}
            {showBottomSheetInstructions && (
              <div className="absolute inset-0 z-[10000] bg-black/85 backdrop-blur-md flex flex-col justify-end transition-all duration-300 animate-[slide-up_0.3s_ease-out]">
                <div className={`w-full max-h-[85%] rounded-t-3xl p-6 overflow-y-auto flex flex-col gap-5 border-t ${
                  theme === "dark" 
                    ? "bg-[#0b0c15] border-neutral-800 text-white" 
                    : "bg-white border-neutral-200 text-neutral-900"
                }`}>
                  
                  {/* Header bar */}
                  <div className="flex items-center justify-between border-b border-neutral-800/25 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🗺️</span>
                      <div>
                        <h4 className="font-extrabold text-base tracking-tight text-blue-400">
                          Route Pinning & Bus Stop Guidelines
                        </h4>
                        <p className="text-[10px] opacity-70">
                          Follow these simple steps to register structured, point-to-point routes
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBottomSheetInstructions(false)}
                      className="text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-transform hover:scale-105 active:scale-95 animate-bounce"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Body content steps bento cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                    
                    {/* Step 1 card */}
                    <div className="p-4 rounded-2xl border border-neutral-800/10 bg-neutral-905/5 hover:border-blue-500/30 transition-all bg-neutral-900/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-xs font-black text-blue-400">
                          1
                        </span>
                        <span className="font-black text-xs text-blue-400 uppercase tracking-wide">
                          Step 1: Route Extremes
                        </span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed text-neutral-300">
                        Click on the map or search to register the <strong>Start Location (Pin A)</strong> and <strong>End Location (Pin B)</strong>. 
                        Once plotted, <strong>click or long-click anywhere on the route line</strong> to place a custom draggable waypoint! Drag this waypoint to dynamically recalculate paths and explore alternative lanes.
                      </p>
                    </div>

                    {/* Step 2 card */}
                    <div className="p-4 rounded-2xl border border-neutral-800/10 bg-neutral-905/5 hover:border-amber-500/30 transition-all bg-neutral-900/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs font-black text-amber-400">
                          2
                        </span>
                        <span className="font-black text-xs text-amber-400 uppercase tracking-wide">
                          Step 2: Bus Route Details
                        </span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed text-neutral-300">
                        Confirm the pinned starting and ending coordinates by clicking <strong>Save & Proceed</strong>.
                        This transitions the panel to the Form screen where you can assign a unique operator name, route name, and mark target transit times.
                      </p>
                    </div>

                    {/* Step 3 card */}
                    <div className="p-4 rounded-2xl border border-neutral-800/10 bg-neutral-905/5 hover:border-red-500/30 transition-all bg-neutral-900/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-xs font-black text-red-400">
                          3
                        </span>
                        <span className="font-black text-xs text-red-400 uppercase tracking-wide">
                          Step 3: Pin Stop Coordination
                        </span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed text-neutral-300">
                        Transition to the final segment and drop the exact <strong>Bus Stop</strong> coordinates. 
                        Drag the Bus Stop marker precisely where the boarding shelter resides, confirming accurate satellite and label alignment.
                      </p>
                    </div>

                  </div>

                  {/* Footer tips and actions */}
                  <div className="mt-2 bg-blue-500/5 border border-blue-500/15 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 mt-1 text-left">
                      <h5 className="text-xs font-black text-blue-400 uppercase tracking-wider">💡 Pro Route Dragging</h5>
                      <p className="text-[10px] opacity-85 leading-relaxed text-neutral-300">
                        • Drag waypoints (the purple <strong>Mid</strong> markers) to dynamically recalculate paths. Invalid terrains snap back gracefully. <br />
                        • Click or drag anywhere on the blue line to drop waypoints, or click any grey dashed alternative route to swap it! <br />
                        • Drag the Start/End markers to shift terminal points; set up to 3 alternative pathways concurrently.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBottomSheetInstructions(false)}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase cursor-pointer rounded-xl shrink-0 tracking-wider shadow-lg transition-transform hover:scale-102 active:scale-98 text-center"
                    >
                      Got It, Let's Pin!
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

      {/* ── REPORT BUS STOP MODAL ── */}
      {reportingStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
            theme === "dark" ? "bg-[#131622] border-[#2e3150] text-white" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-neutral-700/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500">
                  <Flag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base tracking-wide">Report Bus Stop Info</h3>
                  <p className="text-xs text-[#7a7f96]">
                    {reportingStop.name} ({reportingStop.location || "Bus Route"})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReportingStop(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7a7f96] uppercase tracking-wider mb-2">
                  Select Issue / Reason
                </label>
                <div className="space-y-2">
                  {REPORT_OPTIONS.map((option) => (
                    <label
                      key={option}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        reportReason === option
                          ? "border-red-500/80 bg-red-500/10 font-bold"
                          : theme === "dark"
                          ? "border-[#202438] bg-[#1a1d2b] hover:bg-[#22263b]"
                          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={option}
                        checked={reportReason === option}
                        onChange={() => setReportReason(option)}
                        className="accent-red-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dynamic details input field for 'Others' or additional context */}
              {(reportReason === "Others" || reportDetails) && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-[#7a7f96] uppercase tracking-wider mb-1.5">
                    {reportReason === "Others" ? "Specify Details (Required)" : "Additional Details (Optional)"}
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder={reportReason === "Others" ? "Type issue details here..." : "Provide any extra details..."}
                    rows={3}
                    required={reportReason === "Others"}
                    className={`w-full p-3 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      theme === "dark"
                        ? "bg-[#0b0d16] border-[#22253c] text-white placeholder-zinc-500"
                        : "bg-zinc-50 border-zinc-300 text-zinc-900 placeholder-zinc-400"
                    }`}
                  />
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingStop(null)}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    theme === "dark" ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="py-2.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{isSubmittingReport ? "Submitting..." : "Report"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS DROPDOWN / MODAL PANEL ── */}
      {isNotificationOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center md:justify-end p-4 md:pt-16 md:pr-12 bg-black/50 backdrop-blur-xs animate-fade-in">
          {/* Overlay backdrop to close */}
          <div className="fixed inset-0" onClick={() => setIsNotificationOpen(false)} />

          <div className={`relative w-full max-w-sm rounded-2xl border shadow-2xl z-10 overflow-hidden flex flex-col max-h-[80vh] ${
            theme === "dark" ? "bg-[#131622] border-[#2e3150] text-white" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            {/* Panel Header */}
            <div className="p-4 border-b border-neutral-700/30 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-brand-yellow" />
                <h3 className="font-display font-extrabold text-sm tracking-wide">
                  Notifications & Reports
                </h3>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {notifications.filter(n => !n.read).length} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-[10px] text-red-400 hover:underline font-bold px-2 py-1 cursor-pointer"
                    title="Clear all notifications"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setIsNotificationOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Panel Body List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {!userSession ? (
                <div className="text-center py-8 px-4">
                  <Bell className="w-8 h-8 text-neutral-500 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold text-[#7a7f96]">Login to view report notifications for your contributed bus stops.</p>
                  <button
                    onClick={() => { setIsNotificationOpen(false); navigateToTab("login"); }}
                    className="mt-3 py-2 px-4 bg-brand-yellow text-black font-extrabold text-xs rounded-xl cursor-pointer"
                  >
                    Login Now
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <CheckCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold text-[#7a7f96]">No report notifications received.</p>
                  <p className="text-[10px] text-neutral-500 mt-1">When users report issues on your contributed bus stops, notifications will appear here in real-time.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      !notif.read
                        ? "border-red-500/50 bg-red-500/10"
                        : theme === "dark"
                        ? "border-[#202438] bg-[#1a1d2b]"
                        : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="font-extrabold text-xs text-brand-yellow truncate max-w-[180px]">
                          🚌 {notif.stopName}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="text-neutral-500 hover:text-red-400 p-0.5 cursor-pointer"
                        title="Dismiss notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mb-2">
                      <span className="inline-block px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-extrabold rounded-md mb-1">
                        🚩 {notif.reason}
                      </span>
                      {notif.details && (
                        <p className="text-xs text-zinc-300 bg-black/20 p-2 rounded-lg mt-1 italic border border-neutral-800">
                          "{notif.details}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/40">
                      <span>By {notif.reportedBy}</span>
                      {!notif.read && (
                        <button
                          onClick={() => markNotificationAsRead(notif.id)}
                          className="text-emerald-400 hover:underline font-bold cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}