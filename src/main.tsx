import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import OpenAI from 'openai';
import './index.css';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';

// --- PWA 유틸리티 함수 ---
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
};

const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;
};

// --- 다크모드 감지 ---
const getSystemTheme = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// --- PWA 설치 안내 컴포넌트 ---
const PWAInstallPrompt: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">N</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            앱으로 설치하기
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Nova를 홈 화면에 추가하여 더 편리하게 사용하세요.
          </p>
        </div>

        {isIOS ? (
          <div className="mb-4">
            <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg mb-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                iOS에서 설치하는 방법:
              </p>
            </div>
            <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <li className="flex items-center">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs mr-2">1</span>
                하단의 공유 버튼 (□↗) 탭
              </li>
              <li className="flex items-center">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
                "홈 화면에 추가" 선택
              </li>
              <li className="flex items-center">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs mr-2">3</span>
                "추가" 버튼 탭
              </li>
            </ol>
          </div>
        ) : (
          <div className="mb-4">
            {deferredPrompt ? (
              <button
                onClick={handleInstall}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                지금 설치하기
              </button>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  브라우저 메뉴에서 "홈 화면에 추가" 또는 "앱 설치"를 선택하세요.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            나중에
          </button>
          <button
            onClick={() => {
              localStorage.setItem('pwa-prompt-dismissed', 'true');
              onClose();
            }}
            className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            다시 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 타입 정의 ---
// 과제 인터페이스
interface Assignment {
  id: number;
  title: string;          // 과제명
  subject: string;        // 과목
  description?: string;   // 과제 설명 (선택)
  estimatedTime: number;  // 예상 소요시간 (분)
  difficulty: number;     // 난이도 (1-5)
  deadline: string;       // 마감일
  completed: boolean;     // 완료 여부
  totalAllocatedTime: number; // 총 할당된 시간
  completedDates?: string[]; // 완료한 날짜들 (YYYY-MM-DD 형식)
}

// 일일 할당 정보
interface DailyAllocation {
  assignmentId: number;   // 과제 ID
  date: string;           // 날짜 (YYYY-MM-DD)
  allocatedTime: number;  // 할당된 시간 (분)
  completed: boolean;     // 해당 날짜 할당 완료 여부
}

// 기존 Goal 타입은 Assignment의 별칭으로 유지 (하위 호환성)
type Goal = Assignment;

// --- 번역 객체 ---
const translations = {
  ko: {
    // Auth
    language_selection_title: '언어',
    error_title_required: '과제명을 입력해주세요.',
    error_subject_required: '과목을 입력해주세요.',
    error_time_required: '예상 소요시간을 입력해주세요.',
    error_difficulty_required: '난이도를 선택해주세요.',
    error_deadline_required: '마감일을 선택해주세요.',
    
    // Main Page
    my_assignments_title: '📚 과제 스케줄러',
    today_schedule_title: '🎯 오늘 자동 배정된 일정',
    all_assignments_title: '📋 전체 과제 목록',
    sort_label_auto: '자동 정렬',
    sort_label_deadline: '마감일순',
    sort_label_difficulty: '난이도순',
    sort_label_time: '소요시간순',
    add_new_assignment_button: '+ 새 과제 추가',
    filter_all: '전체',
    filter_active: '진행중',
    filter_completed: '완료',
    empty_message_today: '오늘 할당된 과제가 없습니다. 휴식을 취하세요! 😊',
    empty_message_all: '첫 번째 과제를 추가해보세요.',
    empty_message_active: '진행중인 과제가 없습니다.',
    empty_message_completed: '완료된 과제가 없습니다.',
    empty_encouragement_1: '계획적인 학습으로 성공을 향해 나아가세요.',
    empty_encouragement_2: '작은 노력이 큰 성과를 만듭니다.',
    empty_encouragement_3: '오늘의 공부가 내일의 성적을 만듭니다.',
    empty_encouragement_4: '체계적인 과제 관리로 목표를 달성하세요.',
    delete_button: '삭제',
    edit_button_aria: '과제 편집',
    info_button_aria: '상세 정보',
    filter_title: '필터',
    sort_title: '정렬',
    filter_sort_button_aria: '필터 및 정렬',
    calendar_view_button_aria: '캘린더 보기',
    list_view_button_aria: '목록 보기',
    more_options_button_aria: '더 보기',
    select_button_label: '선택',
    cancel_selection_button_label: '취소',
    delete_selected_button_label: '{count}개 삭제',
    delete_selected_confirm_title: '과제 삭제',
    delete_selected_confirm_message: '선택한 {count}개의 과제가 영구적으로 삭제됩니다.',
    days_left: '{count}일 남음',
    d_day: 'D-DAY',
    days_overdue: '{count}일 지남',
    time_allocation: '오늘 {time}분',
    total_time: '총 {time}분',

    // Calendar
    month_names: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
    day_names_short: ["일", "월", "화", "수", "목", "금", "토"],
    day_names_long: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
    calendar_header_month_format: '{year}년 {month}',
    calendar_view_day3: '3일',
    calendar_view_week: '주',
    calendar_view_month: '월',
    
    // Modals & Alerts
    settings_title: '설정',
    confirm_button: '확인',
    new_assignment_modal_title: '새 과제 추가',
    edit_assignment_modal_title: '과제 수정',
    assignment_title_label: '과제명',
    assignment_title_placeholder: '예: 수학 문제집 풀기',
    subject_label: '과목',
    subject_placeholder: '예: 수학',
    description_label: '과제 설명 (선택)',
    description_placeholder: '예: 1-3단원 연습문제 풀이',
    estimated_time_label: '예상 소요시간 (분)',
    estimated_time_placeholder: '예: 60',
    difficulty_label: '난이도',
    difficulty_1: '매우 쉬움',
    difficulty_2: '쉬움',
    difficulty_3: '보통',
    difficulty_4: '어려움',
    difficulty_5: '매우 어려움',
    deadline_label: '마감일',
    ai_analyze_button: '🤖 AI 분석',
    ai_analyzing: 'AI 분석 중...',
    ai_analysis_complete: '✓ 분석 완료',
    cancel_button: '취소',
    add_button: '추가',
    save_button: '저장',
    assignment_details_modal_title: '과제 상세 정보',
    close_button: '닫기',
    delete_account_final_confirm_title: '모든 데이터 삭제',
    delete_account_final_confirm_message: '모든 과제와 데이터가 영구적으로 삭제되며, 이 작업은 되돌릴 수 없습니다.',
    delete_all_data_button: '모든 데이터 삭제',
    settings_done_button: '완료',
    settings_section_data: '데이터 관리',
    settings_export_data: '내보내기',
    settings_import_data: '가져오기',
    import_confirm_title: '데이터 가져오기',
    import_confirm_message: '현재 목표를 새로운 데이터로 교체합니다. 이 작업은 되돌릴 수 없습니다.',
    import_success_toast: '데이터를 성공적으로 가져왔습니다.',
    import_error_alert_title: '가져오기 실패',
    import_error_alert_message: '파일을 읽는 중 오류가 발생했거나 파일 형식이 올바르지 않습니다.',
    settings_section_general: '일반',
    settings_section_info: '정보',
    settings_section_help: '사용방법',
    settings_dark_mode: '다크 모드',
    settings_language: '언어',
    settings_api_key: 'AI 도우미 설정',
    settings_api_key_placeholder: 'OpenAI API 키 입력',
    settings_offline_mode: '오프라인 사용',
    settings_offline_mode_desc: 'AI 기능 없이 기본 앱 기능만 사용',
    language_name: '한국어 (대한민국)',
    language_modal_title: '언어',
    settings_section_background: '화면',
    settings_bg_default: '라이트',
    settings_bg_default_dark: '다크',
    settings_bg_pink: '핑크',
    settings_bg_cherry_noir: '체리 누아르',
    settings_bg_blue: '블루',
    settings_bg_deep_ocean: '오션',
    settings_bg_green: '그린',
    settings_bg_forest_green: '포레스트',
    settings_bg_purple: '퍼플',
    settings_bg_royal_purple: '로얄 퍼플',
    settings_version: '버전',
    settings_developer: '개발자',
    developer_name: 'GimGyuMin',
    settings_copyright: '저작권',
    copyright_notice: '© 2025 GimGyuMin. All Rights Reserved.',
    build_number: '빌드 번호',
    settings_data_header: '데이터 관리',
    settings_data_header_desc: '목표 데이터를 파일로 내보내거나, 파일에서 가져옵니다.',
    settings_background_header: '배경화면',
    settings_background_header_desc: '앱의 배경화면 스타일을 변경하여 개성을 표현해 보세요.',
    data_importing: '가져오는 중...',
    data_exporting: '내보내는 중...',
    data_deleting: '삭제 중...',
    url_import_title: 'URL에서 데이터 불러오기',
    url_import_message: 'URL의 데이터로 현재 목표 목록을 덮어쓰시겠습니까?',
    url_import_confirm: '불러오기',
    url_import_success: 'URL에서 데이터를 성공적으로 가져왔습니다!',
    url_import_error: 'URL의 데이터가 올바르지 않습니다.',
    settings_share_link_header: '링크로 공유',
    settings_generate_link: '공유 링크 생성',
    settings_copy_link: '복사',
    link_copied_toast: '링크가 클립보드에 복사되었습니다.',
    short_url_created: '📎 단축 URL이 생성되었습니다!',
    share_link_created: '🔗 공유 링크가 생성되었습니다!',
    short_url_failed: '⚠️ 단축 URL 생성에 실패하여 기본 링크를 사용합니다.',
    no_data_to_share: '공유할 목표가 없습니다. 먼저 목표를 추가해주세요.',

    // 사용방법
    usage_guide_tab: '사용방법',
    usage_guide_title: '사용 가이드',
    usage_basic_title: '목표 추가하기',
    usage_basic_desc: '1. 홈 화면에서 "목표 추가 및 편집" 버튼을 탭하세요.\n2. 목표, 결과, 장애물, 계획을 차례로 입력하세요.\n3. 마감일과 반복 요일을 선택하세요.\n4. "저장" 버튼을 눌러 목표를 추가하세요.',
    usage_ai_title: 'AI 기능 사용하기',
    usage_ai_desc: '• 목표 작성 시 "AI 제안" 버튼으로 개선된 목표를 받아보세요.\n• 목표 목록에서 "AI 정렬" 버튼으로 중요도 순 정렬이 가능합니다.\n• AI 분석을 통해 더 효과적인 목표 설정을 도와드립니다.\n\n※ AI 기능 사용을 위해서는 API 키 설정이 필요합니다.',
    usage_ai_setup_title: 'AI 기능 설정하기',
    usage_ai_setup_desc: '1. 설정 > 일반에서 API 키 입력란을 찾으세요.\n2. Google Gemini API 키를 입력하세요.\n3. API 키 발급 방법은 다음 Google 지원 문서를 참조하세요:\n   https://ai.google.dev/gemini-api/docs/api-key\n4. 키 입력 후 AI 기능이 활성화됩니다.',
    usage_share_title: '목표 공유하기',
    usage_share_desc: '1. 설정 > 공유에서 "목표 링크 생성" 버튼을 탭하세요.\n2. 자동으로 생성된 단축 링크를 확인하세요.\n3. "링크 복사" 버튼으로 클립보드에 복사하세요.\n4. 메신저나 이메일로 링크를 공유하세요.',
    usage_theme_title: '테마 변경하기',
    usage_theme_desc: '1. 설정 > 모양에서 다크 모드 토글을 사용하세요.\n2. 배경 테마에서 원하는 색상을 선택하세요.\n3. 기본, 핑크, 블루, 그린, 퍼플 테마 중 선택 가능합니다.\n4. 변경 사항은 즉시 적용됩니다.',
    usage_calendar_title: '캘린더 보기 사용하기',
    usage_calendar_desc: '1. 하단 탭에서 캘린더 아이콘을 탭하세요.\n2. 3일/주간/월간 보기를 선택할 수 있습니다.\n3. 날짜를 탭하여 해당 날의 목표를 확인하세요.\n4. 좌우 화살표로 날짜를 이동할 수 있습니다.',
    usage_offline_title: '오프라인 모드 사용하기',
    usage_offline_desc: '1. 설정 > 일반에서 "오프라인 모드" 토글을 켜세요.\n2. API 키 없이도 목표 추가, 편집, 삭제가 가능합니다.\n3. AI 기능은 사용할 수 없지만 모든 기본 기능은 정상 작동합니다.\n4. 데이터는 브라우저에 안전하게 저장됩니다.',
    
    // Goal Assistant
    goal_assistant_title: '새로운 목표',
    goal_assistant_mode_woop: 'WOOP 방식',
    goal_assistant_mode_automation: '빠른 생성',
    automation_title: '목표 시리즈 만들기',
    automation_base_name_label: '목표 이름',
    automation_base_name_placeholder: '예: 영어 단어 학습',
    automation_total_units_label: '총 분량',
    automation_total_units_placeholder: '예: 30',
    automation_units_per_day_label: '일일 분량',
    automation_period_label: '기간',
    automation_start_date_label: '시작일',
    automation_end_date_label: '종료일',
    automation_generate_button: '{count}개 생성',
    automation_error_all_fields: '모든 필드를 올바르게 입력해주세요.',
    automation_error_start_after_end: '시작일은 종료일보다 빨라야 합니다.',
    automation_error_short_period: '기간이 너무 짧습니다. (1일 이상)',

    next_button: '다음',
    back_button: '이전',
    wish_tip: '측정 가능하고 구체적인, 도전적이면서도 현실적인 목표를 설정하세요.',
    wish_example: '예: 3개월 안에 5kg 감량하기, 이번 학기에 A+ 받기',
    outcome_tip: '목표 달성 시 얻게 될 가장 긍정적인 결과를 생생하게 상상해 보세요.',
    outcome_example: '예: 더 건강하고 자신감 있는 모습, 성적 장학금 수령',
    obstacle_tip: '목표 달성을 방해할 수 있는 내면의 장애물(습관, 감정 등)은 무엇인가요?',
    obstacle_example: '예: 퇴근 후 피곤해서 운동 가기 싫은 마음, 어려운 과제를 미루는 습관',
    plan_tip: "'만약 ~라면, ~하겠다' 형식으로 장애물에 대한 구체적인 대응 계획을 세워보세요.",
    plan_example: '예: 만약 퇴근 후 운동 가기 싫다면, 일단 운동복으로 갈아입고 10분만 스트레칭한다.',
    recurrence_label: '반복',
    recurrence_tip: '정해진 요일에 꾸준히 해야 하는 목표인가요? 반복으로 설정하여 연속 달성을 기록해 보세요.',
    recurrence_example: '예: 매주 월,수,금 헬스장 가기',
    recurrence_option_daily: '반복 목표',
    deadline_tip: '현실적인 마감일을 설정하여 동기를 부여하세요. 마감일이 없는 장기 목표도 좋습니다.',
    deadline_option_no_deadline: '마감일 없음',
    day_names_short_picker: ["월", "화", "수", "목", "금", "토", "일"],
    settings_delete_account: '모든 데이터 삭제',
    delete_account_header: '데이터 삭제',
    delete_account_header_desc: '이 작업은 되돌릴 수 없으며, 모든 목표와 데이터가 영구적으로 삭제됩니다.',
    version_update_title: '새로운 기능',
    version_update_1_title: 'AI 도우미 설정',
    version_update_1_desc: 'Gemini API 키를 직접 설정하거나 오프라인 모드로 AI 없이도 앱을 사용할 수 있습니다.',
    version_update_2_title: '목표 공유',
    version_update_2_desc: '목표를 링크로 공유하고 단축 URL로 쉽게 전달하세요. 한국어도 완벽하게 지원합니다.',
    version_update_3_title: '모던 스타일 UI',
    version_update_3_desc: '세련된 모던 디자인 언어와 모바일 최적화로 더욱 직관적인 경험을 제공합니다.',
  },
  en: {
    // Auth
    language_selection_title: 'Language',
    error_wish_required: 'Please enter your wish.',
    error_outcome_required: 'Please enter the outcome.',
    error_obstacle_required: 'Please enter the obstacle.',
    error_plan_required: "Please enter your If-Then plan.",
    error_deadline_required: 'Please select a deadline.',
    error_day_required: 'Please select at least one day.',

    // Main Page
    my_goals_title: 'My Goals',
    sort_label_manual: 'Manual',
    sort_label_deadline: 'Deadline',
    sort_label_newest: 'Newest',
    sort_label_alphabetical: 'Alphabetical',
    sort_label_ai: 'AI Recommended',
    ai_sorting_button: 'Sorting...',
    add_new_goal_button_label: 'Add New Goal',
    filter_all: 'All Goals',
    filter_active: 'In Progress',
    filter_completed: 'Completed',
    empty_message_all: 'Add your first goal to begin your journey.',
    empty_message_active: 'No goals in progress.',
    empty_message_completed: 'No completed goals yet.',
    empty_encouragement_1: 'Take the first step toward something amazing.',
    empty_encouragement_2: 'Small changes lead to big achievements.',
    empty_encouragement_3: 'What you do today shapes tomorrow.',
    empty_encouragement_4: 'Your goals are waiting to become reality.',
    delete_button: 'Delete',
    edit_button_aria: 'Edit Goal',
    info_button_aria: 'Details',
    filter_title: 'Filter',
    sort_title: 'Sort',
    filter_sort_button_aria: 'Filter and Sort',
    calendar_view_button_aria: 'Calendar View',
    list_view_button_aria: 'List View',
    more_options_button_aria: 'More',
    select_button_label: 'Select',
    cancel_selection_button_label: 'Cancel',
    delete_selected_button_label: 'Delete {count}',
    delete_selected_confirm_title: 'Delete Goals',
    delete_selected_confirm_message: 'The {count} selected goals will be permanently deleted.',
    days_left: '{count} days left',
    d_day: 'D-DAY',
    days_overdue: '{count} days overdue',

    // Calendar
    month_names: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    day_names_short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    day_names_long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    calendar_header_month_format: '{month} {year}',
    calendar_view_day3: '3-Day',
    calendar_view_week: 'Week',
    calendar_view_month: 'Month',

    // Modals & Alerts
    settings_title: 'Settings',
    sort_alert_title: 'Unable to Sort',
    sort_alert_message: 'Add at least two goals to use AI recommendations.',
    ai_sort_error_title: 'Sorting Unavailable',
    ai_sort_error_message: 'AI sorting is temporarily unavailable.',
    confirm_button: 'OK',
    new_goal_modal_title: 'New Goal',
    edit_goal_modal_title: 'Edit Goal',
    wish_label: 'Wish',
    outcome_label: 'Outcome',
    obstacle_label: 'Obstacle',
    plan_label: "If-Then Plan",
    deadline_label: 'Deadline',
    cancel_button: 'Cancel',
    add_button: 'Add',
    save_button: 'Save',
    goal_details_modal_title: 'Goal Details',
    ai_coach_suggestion: '🤖 AI Coach',
    ai_analyzing: 'AI Analyzing...',
    close_button: 'Close',
    ai_sort_reason_modal_title: 'AI Sort Rationale',
    ai_sort_criteria: '🤖 AI Sort Criteria',
    delete_account_final_confirm_title: 'Delete All Data',
    delete_account_final_confirm_message: 'All your goals and data will be permanently deleted. This action cannot be undone.',
    delete_all_data_button: 'Delete All Data',
    settings_done_button: 'Done',
    settings_section_data: 'Data Management',
    settings_export_data: 'Export',
    settings_import_data: 'Import',
    import_confirm_title: 'Import Data',
    import_confirm_message: 'This will replace your current goals with new data. This action cannot be undone.',
    import_success_toast: 'Data imported successfully.',
    import_error_alert_title: 'Import Failed',
    import_error_alert_message: 'There was an error reading the file, or the file format is incorrect.',
    settings_section_general: 'General',
    settings_section_info: 'Information',
    settings_section_help: 'How to Use',
    settings_dark_mode: 'Dark Mode',
    settings_language: 'Language',
    settings_api_key: 'AI Assistant',
    settings_api_key_placeholder: 'Enter OpenAI API key',
    settings_offline_mode: 'Offline Mode',
    settings_offline_mode_desc: 'Use basic features without AI',
    language_name: 'English (US)',
    language_modal_title: 'Language',
    settings_section_background: 'Appearance',
    settings_bg_default: 'Light',
    settings_bg_default_dark: 'Dark',
    settings_bg_pink: 'Pink',
    settings_bg_cherry_noir: 'Cherry Noir',
    settings_bg_blue: 'Blue',
    settings_bg_deep_ocean: 'Ocean',
    settings_bg_green: 'Green',
    settings_bg_forest_green: 'Forest',
    settings_bg_purple: 'Purple',
    settings_bg_royal_purple: 'Royal Purple',
    settings_version: 'Version',
    settings_developer: 'Developer',
    developer_name: 'GimGyuMin',
    settings_copyright: 'Copyright',
    copyright_notice: '© 2025 GimGyuMin. All Rights Reserved.',
    build_number: 'Build Number',
    settings_data_header: 'Data Management',
    settings_data_header_desc: 'Export or import your goal data.',
    settings_background_header: 'Background',
    settings_background_header_desc: "Change the app's background style to express your personality.",
    data_importing: 'Importing...',
    data_exporting: 'Exporting...',
    data_deleting: 'Deleting...',
    url_import_title: 'Load from URL',
    url_import_message: 'Overwrite current goals with data from the URL?',
    url_import_confirm: 'Load',
    url_import_success: 'Successfully loaded data from URL!',
    url_import_error: 'Invalid data in URL.',
    settings_share_link_header: 'Share via Link',
    settings_generate_link: 'Generate Share Link',
    settings_copy_link: 'Copy',
    link_copied_toast: 'Link copied to clipboard.',
    short_url_created: '📎 Short URL created successfully!',
    share_link_created: '🔗 Share link generated!',
    short_url_failed: '⚠️ Short URL creation failed, using default link.',
    no_data_to_share: 'No goals to share. Please add goals first.',

    // Usage Guide
    usage_guide_tab: 'How to Use',
    usage_guide_title: 'User Guide',
    usage_basic_title: 'Add a Goal',
    usage_basic_desc: '1. Tap "Add and Edit Goals" button on the home screen.\n2. Fill in your goal, outcome, obstacle, and plan in order.\n3. Select deadline and repeat days.\n4. Tap "Save" to add your goal.',
    usage_ai_title: 'Use AI Features',
    usage_ai_desc: '• Use "AI Suggestion" button when writing goals for improvements.\n• Tap "AI Sort" button to organize goals by importance.\n• Get AI analysis for more effective goal setting.\n\n※ API key setup is required to use AI features.',
    usage_ai_setup_title: 'Set Up AI Features',
    usage_ai_setup_desc: '1. Go to Settings > General and find the API Key field.\n2. Enter your OpenAI API key.\n3. For API key generation:\n   https://platform.openai.com/api-keys\n4. AI features will be activated after entering the key.',
    usage_share_title: 'Share Your Goals',
    usage_share_desc: '1. Go to Settings > Sharing and tap "Create Goal Link".\n2. Review the automatically generated short link.\n3. Tap "Copy Link" to copy to clipboard.\n4. Share the link via messenger or email.',
    usage_theme_title: 'Change Theme',
    usage_theme_desc: '1. Go to Settings > Appearance and use the dark mode toggle.\n2. Select your preferred background theme.\n3. Choose from Default, Pink, Blue, Green, or Purple themes.\n4. Changes are applied immediately.',
    usage_calendar_title: 'Use Calendar View',
    usage_calendar_desc: '1. Tap the calendar icon in the bottom tabs.\n2. Choose between 3-day, weekly, or monthly view.\n3. Tap on any date to see goals for that day.\n4. Use left/right arrows to navigate dates.',
    usage_offline_title: 'Use Offline Mode',
    usage_offline_desc: '1. Go to Settings > General and turn on "Offline Mode".\n2. Add, edit, and delete goals without an API key.\n3. AI features are unavailable, but all basic functions work normally.\n4. Your data is safely stored in the browser.',
    
    // Goal Assistant
    goal_assistant_title: 'Add Goal',
    goal_assistant_mode_woop: 'WOOP',
    goal_assistant_mode_automation: 'Automation',
    automation_title: 'Goal Automation',
    automation_base_name_label: 'Base Goal Name',
    automation_base_name_placeholder: 'e.g., Study Vocabulary',
    automation_total_units_label: 'Total Units',
    automation_total_units_placeholder: 'e.g., 30',
    automation_units_per_day_label: 'Units per Day',
    automation_period_label: 'Period',
    automation_start_date_label: 'Start Date',
    automation_end_date_label: 'End Date',
    automation_generate_button: 'Generate {count}',
    automation_error_all_fields: 'Please fill out all fields correctly.',
    automation_error_start_after_end: 'Start date must be before end date.',
    automation_error_short_period: 'The period is too short (min. 1 day).',

    next_button: 'Next',
    back_button: 'Back',
    wish_tip: 'Set a challenging yet realistic goal. Make it specific and measurable.',
    wish_example: 'e.g., Lose 5kg in 3 months, Get an A+ this semester',
    outcome_tip: 'Imagine the most positive outcome of achieving your goal. The more vivid, the better.',
    outcome_example: 'e.g., Feeling healthier and more confident, Receiving a scholarship',
    obstacle_tip: 'What is the main internal obstacle (e.g., habits, emotions) that could stop you?',
    obstacle_example: 'e.g., Feeling too tired for the gym after work, Procrastinating on difficult tasks',
    plan_tip: "Create a specific plan to overcome your obstacle in an 'if-then' format.",
    plan_example: 'e.g., If I feel too tired for the gym after work, then I will change into my workout clothes and stretch for 10 minutes.',
    recurrence_label: 'Recurrence',
    recurrence_tip: 'Is this a goal you need to work on consistently? Set it as a recurring goal to track your streak.',
    recurrence_example: 'e.g., Go to the gym every Mon, Wed, Fri',
    recurrence_option_daily: 'Recurring Goal',
    deadline_tip: 'Set a realistic deadline to stay motivated. Long-term goals without a deadline are also fine.',
    deadline_option_no_deadline: 'No Deadline',
    day_names_short_picker: ["M", "T", "W", "T", "F", "S", "S"],
    settings_delete_account: 'Delete All Data',
    delete_account_header: 'Delete Data',
    delete_account_header_desc: 'This action is irreversible and will permanently delete all your goals and data.',
    version_update_title: "What's New",
    version_update_1_title: 'AI Assistant Setup',
    version_update_1_desc: 'Configure your OpenAI API key directly or use offline mode to enjoy the app without AI features.',
    version_update_2_title: 'Goal Sharing',
    version_update_2_desc: 'Share your goals via links with short URL support. Perfect Unicode handling for all languages.',
    version_update_3_title: 'Modern Style UI',
    version_update_3_desc: 'Refined modern design language with mobile optimization for a more intuitive experience.',
  }
};

// --- 아이콘 객체 ---
const icons = {
    add: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    more: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>,
    check: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    info: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
    delete: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
    edit: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
    close: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    back: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
    forward: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
    calendar: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
    list: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
    settings: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    filter: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
    ai: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L14.34 8.66L20 11L14.34 13.34L12 19L9.66 13.34L4 11L9.66 8.66L12 3Z"/><path d="M5 21L7 16"/><path d="M19 21L17 16"/></svg>,
    flame: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>,
    data: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>,
    background: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
    account: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    infoCircle: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
    help: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
    moon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
    exclamation: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm1-4h-2V7h2v6z"/></svg>,
    globe: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 1.53 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>,
    sync: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>,
};

// --- 유틸리티 함수 ---
const isSameDay = (date1: string | Date, date2: string | Date) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

const getRelativeTime = (deadline: string, t: (key: string) => string) => {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return t('d_day');
  } else if (diffDays > 0) {
    return t('days_left').replace('{count}', String(diffDays));
  } else {
    return t('days_overdue').replace('{count}', String(Math.abs(diffDays)));
  }
};

const getStartOfWeek = (date: Date, startOfWeek = 1): Date => { // 0=Sun, 1=Mon
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day < startOfWeek ? 7 : 0) + day - startOfWeek;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

// --- UTF-8 안전한 인코딩/디코딩 함수 ---
const utf8ToBase64 = (str: string): string => {
    try {
        // 한국어 등 UTF-8 문자를 안전하게 처리
        const encoded = new TextEncoder().encode(str);
        const binaryString = Array.from(encoded).map(byte => String.fromCharCode(byte)).join('');
        return btoa(binaryString);
    } catch (error) {
        console.error('UTF-8 to Base64 encoding failed:', error);
        return '';
    }
};

const base64ToUtf8 = (base64: string): string => {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    } catch (error) {
        console.error('Base64 to UTF-8 decoding failed:', error);
        return '';
    }
};

// --- 데이터 압축 및 URL 최적화 함수 ---
const compressDataForUrl = (data: any): string => {
    try {
        // JSON을 최대한 압축
        const jsonStr = JSON.stringify(data);
        
        // 불필요한 공백 제거
        const compressedJson = jsonStr.replace(/\s+/g, ' ').trim();
        
        // UTF-8 안전한 Base64 인코딩
        return utf8ToBase64(compressedJson);
    } catch (error) {
        console.error('Data compression failed:', error);
        return utf8ToBase64(JSON.stringify(data));
    }
};

// --- 단축 URL 생성 함수 (CORS 문제 해결) ---
const createShortUrl = async (longUrl: string): Promise<string> => {
    // URL이 너무 길지 않으면 그대로 사용
    if (longUrl.length < 1500) {
        return longUrl;
    }
    
    const shortUrlServices = [
        // 1. is.gd API 사용
        {
            name: 'is.gd',
            createUrl: async (url: string) => {
                const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
                if (!response.ok) throw new Error('is.gd API failed');
                const shortUrl = await response.text();
                if (shortUrl.includes('Error') || !shortUrl.startsWith('http')) {
                    throw new Error('Invalid response from is.gd');
                }
                return shortUrl.trim();
            }
        },
        // 2. TinyURL JSONP fallback
        {
            name: 'tinyurl',
            createUrl: async (url: string) => {
                return new Promise((resolve, reject) => {
                    const callbackName = `tinyurl_${Date.now()}`;
                    const script = document.createElement('script');
                    
                    const timeout = setTimeout(() => {
                        cleanup();
                        reject(new Error('TinyURL timeout'));
                    }, 5000);
                    
                    const cleanup = () => {
                        clearTimeout(timeout);
                        if (script.parentNode) {
                            document.head.removeChild(script);
                        }
                        delete (window as any)[callbackName];
                    };
                    
                    (window as any)[callbackName] = (result: any) => {
                        cleanup();
                        if (result && typeof result === 'string' && !result.includes('Error') && result.startsWith('http')) {
                            resolve(result.trim());
                        } else {
                            reject(new Error('Invalid TinyURL response'));
                        }
                    };
                    
                    script.onerror = () => {
                        cleanup();
                        reject(new Error('TinyURL script load failed'));
                    };
                    
                    script.src = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}&callback=${callbackName}`;
                    document.head.appendChild(script);
                });
            }
        },
        // 3. v.gd API 사용
        {
            name: 'v.gd',
            createUrl: async (url: string) => {
                const response = await fetch(`https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
                if (!response.ok) throw new Error('v.gd API failed');
                const shortUrl = await response.text();
                if (shortUrl.includes('Error') || !shortUrl.startsWith('http')) {
                    throw new Error('Invalid response from v.gd');
                }
                return shortUrl.trim();
            }
        }
    ];
    
    // 각 서비스를 순차적으로 시도
    for (const service of shortUrlServices) {
        try {
            console.log(`Trying ${service.name} for URL shortening...`);
            const shortUrl = await service.createUrl(longUrl);
            console.log(`✅ ${service.name} success:`, shortUrl);
            return shortUrl as string;
        } catch (error) {
            console.warn(`❌ ${service.name} failed:`, error);
            continue;
        }
    }
    
    // 모든 서비스 실패 시 원본 URL 반환
    console.warn('All URL shortening services failed, using original URL');
    return longUrl;
};

// --- 배경화면 옵션 ---
const backgroundOptions = [
    { id: 'default', lightThemeClass: 'bg-solid-default', darkThemeClass: 'bg-solid-default', lightNameKey: 'settings_bg_default', darkNameKey: 'settings_bg_default_dark' },
    { id: 'pink', lightThemeClass: 'bg-solid-pink', darkThemeClass: 'bg-solid-pink', lightNameKey: 'settings_bg_pink', darkNameKey: 'settings_bg_cherry_noir' },
    { id: 'blue', lightThemeClass: 'bg-solid-blue', darkThemeClass: 'bg-solid-blue', lightNameKey: 'settings_bg_blue', darkNameKey: 'settings_bg_deep_ocean' },
    { id: 'green', lightThemeClass: 'bg-solid-green', darkThemeClass: 'bg-solid-green', lightNameKey: 'settings_bg_green', darkNameKey: 'settings_bg_forest_green' },
    { id: 'purple', lightThemeClass: 'bg-solid-purple', darkThemeClass: 'bg-solid-purple', lightNameKey: 'settings_bg_purple', darkNameKey: 'settings_bg_royal_purple' },
];

// --- 메인 앱 컴포넌트 ---
const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState(false); // false로 시작하여 즉시 렌더링
    const [language, setLanguage] = useState<string>(() => localStorage.getItem('nova-lang') || 'ko');
    const [todos, setTodos] = useState<Goal[]>([]);
    const [dailyAllocations, setDailyAllocations] = useState<DailyAllocation[]>(() => {
        const saved = localStorage.getItem('nova-allocations');
        return saved ? JSON.parse(saved) : [];
    });
    const [filter, setFilter] = useState<string>('all');
    const [sortType, setSortType] = useState<string>('auto');
    
    // 다크모드 시스템 설정 따라가기
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const savedTheme = localStorage.getItem('nova-theme');
        if (savedTheme === 'system' || !savedTheme) {
            return getSystemTheme() === 'dark';
        }
        return savedTheme === 'dark';
    });
    const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
        return localStorage.getItem('nova-theme') as 'light' | 'dark' | 'system' || 'system';
    });
    
    const [backgroundTheme, setBackgroundTheme] = useState<string>('default');
    const [isGoalAssistantOpen, setIsGoalAssistantOpen] = useState<boolean>(false);
    const [editingTodo, setEditingTodo] = useState<Goal | null>(null);
    const [infoTodo, setInfoTodo] = useState<Goal | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [isAiSorting, setIsAiSorting] = useState<boolean>(false);
    const [isViewModeCalendar, setIsViewModeCalendar] = useState<boolean>(false);
    const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; onConfirm?: () => void; onCancel?: () => void; confirmText?: string; cancelText?: string; isDestructive?: boolean } | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedTodoIds, setSelectedTodoIds] = useState<Set<number>>(new Set());
    const [toastMessage, setToastMessage] = useState<string>('');
    const [dataActionStatus, setDataActionStatus] = useState<'idle' | 'importing' | 'exporting' | 'deleting'>('idle');
    const [isVersionInfoOpen, setIsVersionInfoOpen] = useState<boolean>(false);
    const [isUsageGuideOpen, setIsUsageGuideOpen] = useState<boolean>(false);
    
    // PWA 관련 상태
    const [showPWAPrompt, setShowPWAPrompt] = useState<boolean>(false);
    
    // API 키 및 오프라인 모드 상태 추가
    const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('nova-api-key') || '');
    const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => localStorage.getItem('nova-offline-mode') === 'true');

    const t = useCallback((key: string): any => {
        return translations[language][key] || key;
    }, [language]);

    // AI 인스턴스 생성 함수
    const createAI = useCallback((key?: string) => {
        const effectiveApiKey = key || apiKey;
        if (isOfflineMode || !effectiveApiKey) {
            return null;
        }
        try {
            return new OpenAI({ 
                apiKey: effectiveApiKey,
                dangerouslyAllowBrowser: true 
            });
        } catch (error) {
            console.error('Failed to create AI instance:', error);
            return null;
        }
    }, [apiKey, isOfflineMode]);

    // 테마 모드 변경 함수
    const handleThemeChange = useCallback((mode: 'light' | 'dark' | 'system') => {
        setThemeMode(mode);
    }, []);

    const encouragementMessages = useMemo(() => [
        t('empty_encouragement_1'),
        t('empty_encouragement_2'),
        t('empty_encouragement_3'),
        t('empty_encouragement_4'),
    ], [t]);

    const randomEncouragement = useMemo(() => encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)], [encouragementMessages]);

    // Firestore에서 사용자 데이터 로드
    const loadUserDataFromFirestore = useCallback(async (userId: string) => {
        try {
            console.log('Firestore에서 데이터 로드 중...', userId);
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                console.log('로드된 데이터:', data);
                
                if (data.assignments && Array.isArray(data.assignments)) {
                    setTodos(data.assignments);
                    console.log('과제 로드 완료:', data.assignments.length, '개');
                }
                if (data.allocations && Array.isArray(data.allocations)) {
                    setDailyAllocations(data.allocations);
                    console.log('할당 로드 완료:', data.allocations.length, '개');
                }
            } else {
                console.log('Firestore에 저장된 데이터가 없습니다.');
                // 로컬 스토리지 데이터 확인
                const localTodos = localStorage.getItem('nova-todos');
                const localAllocations = localStorage.getItem('nova-allocations');
                
                if (localTodos) {
                    const parsedTodos = JSON.parse(localTodos);
                    setTodos(parsedTodos);
                    console.log('로컬 과제 데이터 로드:', parsedTodos.length, '개');
                }
                
                if (localAllocations) {
                    const parsedAllocations = JSON.parse(localAllocations);
                    setDailyAllocations(parsedAllocations);
                    console.log('로컬 할당 데이터 로드:', parsedAllocations.length, '개');
                }
            }
        } catch (error) {
            console.error('Firestore 데이터 로드 실패:', error);
        }
    }, []);
    
    // Firestore에 사용자 데이터 저장
    const saveUserDataToFirestore = useCallback(async (assignments: Goal[], allocations: DailyAllocation[]) => {
        if (!user) {
            console.log('사용자가 로그인되어 있지 않아 Firestore에 저장하지 않습니다.');
            return;
        }
        
        try {
            console.log('Firestore에 저장 중...', {
                assignments: assignments.length,
                allocations: allocations.length
            });
            
            // undefined 값 및 WOOP 관련 필드 제거 함수
            const removeUndefined = (obj: any): any => {
                if (Array.isArray(obj)) {
                    return obj.map(item => removeUndefined(item));
                }
                if (obj !== null && typeof obj === 'object') {
                    const cleaned: any = {};
                    for (const key in obj) {
                        // WOOP 및 반복 관련 필드 제외
                        if (key === 'wish' || key === 'outcome' || key === 'obstacle' || key === 'plan' || 
                            key === 'isRecurring' || key === 'recurringDays' || key === 'lastCompletedDate' || key === 'streak') {
                            continue;
                        }
                        if (obj[key] !== undefined) {
                            cleaned[key] = removeUndefined(obj[key]);
                        }
                    }
                    return cleaned;
                }
                return obj;
            };
            
            // undefined 값 및 불필요한 필드 제거
            const cleanedAssignments = removeUndefined(assignments);
            const cleanedAllocations = removeUndefined(allocations);
            
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                assignments: cleanedAssignments,
                allocations: cleanedAllocations,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            console.log('Firestore 저장 완료!');
        } catch (error) {
            console.error('Firestore 저장 실패:', error);
            throw error;
        }
    }, [user]);

    // Google 로그인
    const handleGoogleLogin = useCallback(async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            setToastMessage('로그인 성공!');
        } catch (error: any) {
            console.error('로그인 실패:', error);
            let errorMessage = '로그인 중 오류가 발생했습니다.';
            
            if (error.code === 'auth/operation-not-allowed') {
                errorMessage = 'Firebase Console에서 Google 로그인을 활성화해야 합니다.\n\n1. Firebase Console 접속\n2. Authentication > Sign-in method\n3. Google 제공업체 활성화';
            } else if (error.code === 'auth/unauthorized-domain') {
                errorMessage = '현재 도메인이 승인되지 않았습니다. Firebase Console에서 도메인을 추가해주세요.';
            } else if (error.code === 'auth/popup-blocked') {
                errorMessage = '팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.';
            } else if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = '로그인이 취소되었습니다.';
            }
            
            setAlertConfig({
                title: '로그인 실패',
                message: errorMessage
            });
        }
    }, []);
    
    // 로그아웃
    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
            setTodos([]);
            setDailyAllocations([]);
            setToastMessage('로그아웃 되었습니다.');
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    }, []);
    
    // 수동 동기화
    const handleSync = useCallback(async () => {
        if (!user) {
            setToastMessage('로그인이 필요합니다.');
            return;
        }
        
        try {
            setToastMessage('동기화 중...');
            
            // 1. 현재 데이터를 Firestore에 저장
            await saveUserDataToFirestore(todos, dailyAllocations);
            
            // 2. Firestore에서 최신 데이터 다시 로드
            await loadUserDataFromFirestore(user.uid);
            
            setToastMessage('✓ 동기화 완료!');
        } catch (error) {
            console.error('동기화 실패:', error);
            setToastMessage('동기화 실패. 다시 시도해주세요.');
        }
    }, [user, todos, dailyAllocations, saveUserDataToFirestore, loadUserDataFromFirestore]);

    // Firebase 인증 상태 감지
    useEffect(() => {
        let mounted = true;
        setIsLoadingUser(true);
        
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!mounted) return;
            
            try {
                setUser(currentUser);
                
                if (currentUser) {
                    // 로그인된 경우 Firestore에서 데이터 로드
                    await loadUserDataFromFirestore(currentUser.uid);
                } else {
                    // 로그아웃된 경우 로컬 스토리지에서 데이터 로드
                    const savedTodos = localStorage.getItem('nova-todos');
                    const savedAllocations = localStorage.getItem('nova-allocations');
                    if (savedTodos) {
                        try {
                            const parsedTodos: Goal[] = JSON.parse(savedTodos);
                            setTodos(parsedTodos);
                        } catch (e) {
                            console.error('로컬 데이터 파싱 오류:', e);
                        }
                    }
                    if (savedAllocations) {
                        try {
                            const parsedAllocations: DailyAllocation[] = JSON.parse(savedAllocations);
                            setDailyAllocations(parsedAllocations);
                        } catch (e) {
                            console.error('로컬 할당 데이터 파싱 오류:', e);
                        }
                    }
                }
            } catch (error) {
                console.error('인증 상태 처리 중 오류:', error);
            } finally {
                if (mounted) {
                    setIsLoadingUser(false);
                }
            }
        }, (error) => {
            console.error('Firebase 인증 오류:', error);
            if (mounted) {
                setIsLoadingUser(false);
            }
        });
        
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [loadUserDataFromFirestore]);

    // 설정 데이터만 로컬 스토리지에서 로드 (테마, 정렬 등)
    useEffect(() => {
        const savedDarkMode = localStorage.getItem('nova-dark-mode');
        const savedBackground = localStorage.getItem('nova-background');
        const savedSortType = localStorage.getItem('nova-sort-type');

        if (savedDarkMode) setIsDarkMode(JSON.parse(savedDarkMode));
        if (savedBackground) setBackgroundTheme(savedBackground);
        if (savedSortType) setSortType(savedSortType);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const dataFromUrl = urlParams.get('data');
        if (dataFromUrl) {
            try {
                const decodedJson = base64ToUtf8(dataFromUrl);
                const importedTodos = JSON.parse(decodedJson);
                // 과제 데이터 검증: title 필드가 있는지 확인
                if (Array.isArray(importedTodos) && (importedTodos.length === 0 || ('title' in importedTodos[0] && 'id' in importedTodos[0]))) {
                    setAlertConfig({
                        title: t('url_import_title'),
                        message: t('url_import_message'),
                        confirmText: t('url_import_confirm'),
                        cancelText: t('cancel_button'),
                        onConfirm: () => {
                            setTodos(importedTodos);
                            setToastMessage(t('url_import_success'));
                            window.history.replaceState({}, document.title, window.location.pathname);
                        },
                        onCancel: () => {
                             window.history.replaceState({}, document.title, window.location.pathname);
                        }
                    });
                } else { throw new Error("Invalid data format"); }
            } catch (e) {
                console.error("Failed to parse data from URL", e);
                setAlertConfig({ title: t('import_error_alert_title'), message: t('url_import_error') });
                 window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, [t]);

    
    // 시스템 다크모드 감지 및 적용
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleThemeChange = (e: MediaQueryListEvent) => {
            if (themeMode === 'system') {
                setIsDarkMode(e.matches);
            }
        };

        // 테마 모드 변경 시 적용
        if (themeMode === 'system') {
            setIsDarkMode(mediaQuery.matches);
        } else {
            setIsDarkMode(themeMode === 'dark');
        }

        mediaQuery.addEventListener('change', handleThemeChange);
        return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }, [themeMode]);

    // PWA 설치 프롬프트 표시 로직
    useEffect(() => {
        const checkPWAPrompt = () => {
            const isDismissed = localStorage.getItem('pwa-prompt-dismissed');
            const isMobileDevice = isMobile();
            const isInStandalone = isStandalone();
            
            if (isMobileDevice && !isInStandalone && !isDismissed) {
                // 첫 방문 후 3초 뒤에 프롬프트 표시
                const timer = setTimeout(() => {
                    setShowPWAPrompt(true);
                }, 3000);
                
                return () => clearTimeout(timer);
            }
        };

        checkPWAPrompt();
    }, []);

    // Service Worker 등록
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/Nova-AI-Planer/sw.js')
                .then((registration) => {
                    console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }, []);

    // 테마 설정 저장 및 다크모드 상태 저장 수정
    useEffect(() => { 
        localStorage.setItem('nova-theme', themeMode); 
        localStorage.setItem('nova-dark-mode', JSON.stringify(isDarkMode)); 
    }, [themeMode, isDarkMode]);

    useEffect(() => { localStorage.setItem('nova-lang', language); }, [language]);
    
    // todos 저장 (로컬 + Firestore)
    useEffect(() => { 
        if (isLoadingUser) return; // 로딩 중에는 저장하지 않음
        
        // 로컬 스토리지에 저장 (로그인 안 한 경우)
        if (!user) {
            localStorage.setItem('nova-todos', JSON.stringify(todos));
        }
        
        // Firestore에 저장 (로그인된 경우)
        if (user && todos.length > 0) {
            const timeoutId = setTimeout(() => {
                saveUserDataToFirestore(todos, dailyAllocations);
            }, 500); // 디바운스: 0.5초 후에 저장
            return () => clearTimeout(timeoutId);
        }
    }, [todos, user, isLoadingUser]);
    
    // allocations 저장 (로컬 + Firestore)
    useEffect(() => { 
        if (isLoadingUser) return; // 로딩 중에는 저장하지 않음
        
        // 로컬 스토리지에 저장 (로그인 안 한 경우)
        if (!user) {
            localStorage.setItem('nova-allocations', JSON.stringify(dailyAllocations));
        }
        
        // Firestore에 저장 (로그인된 경우)
        if (user && dailyAllocations.length > 0) {
            const timeoutId = setTimeout(() => {
                saveUserDataToFirestore(todos, dailyAllocations);
            }, 500); // 디바운스: 0.5초 후에 저장
            return () => clearTimeout(timeoutId);
        }
    }, [dailyAllocations, user, isLoadingUser]);
    
    useEffect(() => { localStorage.setItem('nova-api-key', apiKey); }, [apiKey]);
    useEffect(() => { localStorage.setItem('nova-offline-mode', String(isOfflineMode)); }, [isOfflineMode]);

    useEffect(() => {
        const selectedTheme = backgroundOptions.find(opt => opt.id === backgroundTheme) || backgroundOptions[0];
        const themeClass = isDarkMode ? selectedTheme.darkThemeClass : selectedTheme.lightThemeClass;
        
        document.body.className = ''; // Reset classes
        if (isDarkMode) document.body.classList.add('dark-mode');
        if (themeClass) document.body.classList.add(themeClass);
        
        localStorage.setItem('nova-background', backgroundTheme);
    }, [backgroundTheme, isDarkMode]);

    useEffect(() => { localStorage.setItem('nova-sort-type', sortType); }, [sortType]);
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // 자동 분배 알고리즘
    const calculateDailyAllocations = useCallback((assignments: Assignment[]) => {
        const activeAssignments = assignments.filter(a => !a.completed);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const newAllocations: DailyAllocation[] = [];
        
        // 1단계: 과제 정렬 (마감일 가까운 순 > 소요시간 긴 순 > 난이도 높은 순)
        const sortedAssignments = [...activeAssignments].sort((a, b) => {
            // 마감일 비교
            const daysLeftA = Math.ceil((new Date(a.deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const daysLeftB = Math.ceil((new Date(b.deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeftA !== daysLeftB) return daysLeftA - daysLeftB;
            
            // 소요시간 비교 (긴 것 우선)
            if (a.estimatedTime !== b.estimatedTime) return b.estimatedTime - a.estimatedTime;
            
            // 난이도 비교 (높은 것 우선)
            return b.difficulty - a.difficulty;
        });
        
        // 2단계: 각 과제를 일별로 분배
        sortedAssignments.forEach(assignment => {
            const deadline = new Date(assignment.deadline);
            deadline.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysLeft <= 0) return; // 마감일 지난 과제는 스킵
            
            const dailyTime = Math.ceil(assignment.estimatedTime / daysLeft);
            
            // 오늘부터 마감일까지 매일 할당
            for (let i = 0; i < daysLeft; i++) {
                const allocationDate = new Date(today);
                allocationDate.setDate(today.getDate() + i);
                const dateStr = allocationDate.toISOString().split('T')[0];
                
                newAllocations.push({
                    assignmentId: assignment.id,
                    date: dateStr,
                    allocatedTime: dailyTime,
                    completed: false
                });
            }
        });
        
        setDailyAllocations(newAllocations);
    }, []);
    
    // 과제가 변경될 때마다 자동 분배 재계산
    useEffect(() => {
        if (todos.length > 0) {
            calculateDailyAllocations(todos);
        } else {
            setDailyAllocations([]);
        }
    }, [todos, calculateDailyAllocations]);
    
    // 오늘 날짜의 할당된 과제 필터링
    const todayAllocations = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return dailyAllocations.filter(alloc => alloc.date === today);
    }, [dailyAllocations]);
    
    // 오늘의 과제 목록 (할당된 시간 정보 포함)
    const todayAssignments = useMemo(() => {
        return todayAllocations.map(alloc => {
            const assignment = todos.find(t => t.id === alloc.assignmentId);
            return assignment ? { ...assignment, todayTime: alloc.allocatedTime, allocationCompleted: alloc.completed } : null;
        }).filter(a => a !== null) as (Assignment & { todayTime: number; allocationCompleted: boolean })[];
    }, [todayAllocations, todos]);

    const filteredTodos = useMemo(() => {
        let sortedTodos = [...todos];
        
        if (sortType === 'auto') {
            // 자동 정렬: 마감일 > 소요시간 > 난이도
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            sortedTodos.sort((a, b) => {
                const daysLeftA = Math.ceil((new Date(a.deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const daysLeftB = Math.ceil((new Date(b.deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysLeftA !== daysLeftB) return daysLeftA - daysLeftB;
                if (a.estimatedTime !== b.estimatedTime) return b.estimatedTime - a.estimatedTime;
                return b.difficulty - a.difficulty;
            });
        } else if (sortType === 'deadline') {
            sortedTodos.sort((a, b) => {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            });
        } else if (sortType === 'difficulty') {
            sortedTodos.sort((a, b) => b.difficulty - a.difficulty);
        } else if (sortType === 'time') {
            sortedTodos.sort((a, b) => b.estimatedTime - a.estimatedTime);
        }

        if (filter === 'active') return sortedTodos.filter(todo => !todo.completed);
        if (filter === 'completed') return sortedTodos.filter(todo => todo.completed);
        return sortedTodos;
    }, [todos, filter, sortType]);
    
    const handleAddTodo = (newTodoData: Omit<Assignment, 'id' | 'completed' | 'totalAllocatedTime'>) => {
        const newTodo: Assignment = { 
            ...newTodoData, 
            id: Date.now(), 
            completed: false,
            totalAllocatedTime: 0
        };
        setTodos(prev => [newTodo, ...prev]);
        setIsGoalAssistantOpen(false);
    };
    
    const handleAddMultipleTodos = (newTodosData: Omit<Goal, 'id' | 'completed' | 'lastCompletedDate' | 'streak'>[]) => {
        const newTodos: Goal[] = newTodosData.map((goalData, index) => ({
            ...goalData,
            id: Date.now() + index,
            completed: false,
            lastCompletedDate: null,
            streak: 0,
        })).reverse(); // So the first goal appears at the top
        setTodos(prev => [...newTodos, ...prev]);
        setIsGoalAssistantOpen(false);
    };

    const handleEditTodo = (updatedTodo: Goal) => {
        setTodos(todos.map(todo => (todo.id === updatedTodo.id ? updatedTodo : todo)));
        setEditingTodo(null);
    };

    const handleDeleteTodo = (id: number) => {
        setTodos(todos.filter(todo => todo.id !== id));
        // 해당 과제의 할당도 삭제
        setDailyAllocations(dailyAllocations.filter(alloc => alloc.assignmentId !== id));
    };

    const handleToggleComplete = (id: number) => {
        const today = new Date().toISOString().split('T')[0];
        
        setTodos(todos.map(todo => {
            if (todo.id === id) {
                const completedDates = todo.completedDates || [];
                const isCompletedToday = completedDates.includes(today);
                
                let newCompletedDates;
                if (isCompletedToday) {
                    // 오늘 날짜 제거 (체크 해제)
                    newCompletedDates = completedDates.filter(date => date !== today);
                } else {
                    // 오늘 날짜 추가 (체크)
                    newCompletedDates = [...completedDates, today];
                }
                
                // 모든 날짜가 완료되었는지 확인하여 completed 상태 결정
                const isFullyCompleted = todo.completed || (!isCompletedToday && completedDates.length > 0);
                
                return { 
                    ...todo, 
                    completedDates: newCompletedDates,
                    completed: newCompletedDates.length > 0 ? isFullyCompleted : false
                };
            }
            return todo;
        }));
        
        // 오늘의 할당도 완료 처리
        setDailyAllocations(dailyAllocations.map(alloc => {
            if (alloc.assignmentId === id && alloc.date === today) {
                return { ...alloc, completed: !alloc.completed };
            }
            return alloc;
        }));
    };
    
    const handleSort = async (type: string) => {
        if (type === 'ai') {
            if (todos.length < 2) {
                setAlertConfig({ title: t('sort_alert_title'), message: t('sort_alert_message') });
                return;
            }
            setIsAiSorting(true);
            try {
                const ai = createAI();
                if (!ai) {
                    setToastMessage(isOfflineMode ? '오프라인 모드에서는 AI 정렬을 사용할 수 없습니다.' : 'AI 정렬을 사용하려면 설정에서 API 키를 입력해주세요.');
                    setIsAiSorting(false);
                    setSortType('manual');
                    return;
                }
                
                const prompt = `Here is a list of assignments with their details (title, subject, deadline, difficulty, estimatedTime). Prioritize them based on urgency (closer deadline), difficulty, and time required. Return a JSON object with a single key "sorted_ids" which is an array of the assignment IDs in the recommended order. Do not include any other text or explanations. Assignments: ${JSON.stringify(todos.map(({ id, title, subject, deadline, difficulty, estimatedTime }) => ({ id, title, subject, deadline, difficulty, estimatedTime })))}`;
                const response = await ai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are an assignment prioritization expert.' },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7
                });
                
                const resultJson = JSON.parse(response.choices[0].message.content || '{}');
                const sortedIds: number[] = resultJson.sorted_ids.map(Number);
                const todoMap = new Map(todos.map(todo => [Number(todo.id), todo]));
                const sortedTodos = sortedIds.map(id => todoMap.get(id)).filter(Boolean) as Goal[];
                const unsortedTodos = todos.filter(todo => !sortedIds.includes(Number(todo.id)));
                const finalSortedTodos = [...sortedTodos, ...unsortedTodos].map(todo => ({ ...todo, id: Number(todo.id) }));

                setTodos(finalSortedTodos);
                setSortType('manual');
            } catch (error) {
                console.error("AI sort failed:", error);
                setAlertConfig({ title: t('ai_sort_error_title'), message: t('ai_sort_error_message') });
            } finally {
                setIsAiSorting(false);
            }
        } else {
            setSortType(type);
        }
    };
    
    const handleSelectTodo = (id: number) => {
        const newSelectedIds = new Set(selectedTodoIds);
        if (newSelectedIds.has(id)) newSelectedIds.delete(id);
        else newSelectedIds.add(id);
        setSelectedTodoIds(newSelectedIds);
    };

    const handleCancelSelection = () => {
        setIsSelectionMode(false);
        setSelectedTodoIds(new Set());
    };

    const handleDeleteSelected = () => {
        const count = selectedTodoIds.size;
        setAlertConfig({
            title: t('delete_selected_confirm_title'),
            message: t('delete_selected_confirm_message').replace('{count}', String(count)),
            isDestructive: true,
            confirmText: t('delete_selected_button_label').replace('{count}', String(count)),
            cancelText: t('cancel_button'),
            onConfirm: () => {
                setTodos(todos.filter(todo => !selectedTodoIds.has(todo.id)));
                handleCancelSelection();
            }
        });
    };
    
    const handleExportData = () => {
        setDataActionStatus('exporting');
        const dataStr = JSON.stringify(todos, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = 'nova_goals.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        setTimeout(() => {
            setDataActionStatus('idle');
            setIsSettingsOpen(false);
        }, 1500);
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("File content is not a string");
                const importedTodos = JSON.parse(text);
                // 과제 데이터 검증: title, subject 필드가 있는지 확인
                if (Array.isArray(importedTodos) && importedTodos.every(item => 'title' in item && 'id' in item)) {
                     setAlertConfig({
                        title: t('import_confirm_title'),
                        message: t('import_confirm_message'),
                        confirmText: t('settings_import_data'),
                        cancelText: t('cancel_button'),
                        onConfirm: () => {
                            setDataActionStatus('importing');
                            setTimeout(() => {
                                setTodos(importedTodos);
                                setToastMessage(t('import_success_toast'));
                                setDataActionStatus('idle');
                                setIsSettingsOpen(false);
                            }, 1500);
                        }
                    });
                } else { throw new Error("Invalid file format"); }
            } catch (error) {
                 setAlertConfig({ title: t('import_error_alert_title'), message: t('import_error_alert_message') });
            }
        };
        reader.onerror = () => setAlertConfig({ title: t('import_error_alert_title'), message: t('import_error_alert_message') });
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleDeleteAllData = () => {
        setDataActionStatus('deleting');
        setTimeout(() => {
            setTodos([]);
            setLanguage('ko');
            setIsDarkMode(true);
            setBackgroundTheme('default');
            setSortType('manual');
            localStorage.clear();
            setDataActionStatus('idle');
            setIsSettingsOpen(false);
        }, 1500);
    };

    const isAnyModalOpen = isGoalAssistantOpen || !!editingTodo || !!infoTodo || isSettingsOpen || !!alertConfig || isVersionInfoOpen || isUsageGuideOpen;

    return (
        <div className={`main-page-layout ${isViewModeCalendar ? 'calendar-view-active' : ''}`}>
            <div className={`page-content ${isAnyModalOpen ? 'modal-open' : ''}`}>
                <div className="container">
                    <Header 
                        t={t} 
                        isSelectionMode={isSelectionMode} 
                        selectedCount={selectedTodoIds.size} 
                        onCancelSelection={handleCancelSelection} 
                        onDeleteSelected={handleDeleteSelected} 
                        isViewModeCalendar={isViewModeCalendar} 
                        onToggleViewMode={() => setIsViewModeCalendar(!isViewModeCalendar)} 
                        isAiSorting={isAiSorting} 
                        sortType={sortType} 
                        onSort={handleSort} 
                        filter={filter} 
                        onFilter={setFilter} 
                        onSetSelectionMode={() => setIsSelectionMode(true)}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                        onAddGoal={() => setIsGoalAssistantOpen(true)}
                        user={user}
                        onSync={handleSync}
                    />
                    {isViewModeCalendar ? (
                        <CalendarView todos={todos} t={t} onGoalClick={setInfoTodo} language={language} />
                    ) : (
                        <TodoList 
                            todos={filteredTodos} 
                            todayAssignments={todayAssignments}
                            onToggleComplete={handleToggleComplete} 
                            onDelete={handleDeleteTodo} 
                            onEdit={setEditingTodo} 
                            onInfo={setInfoTodo} 
                            t={t} 
                            filter={filter} 
                            randomEncouragement={randomEncouragement} 
                            isSelectionMode={isSelectionMode} 
                            selectedTodoIds={selectedTodoIds} 
                            onSelectTodo={handleSelectTodo} 
                        />
                    )}
                </div>
                </div>

                {isGoalAssistantOpen && <AssignmentModal onClose={() => setIsGoalAssistantOpen(false)} onAddTodo={handleAddTodo} t={t} createAI={createAI} />}
            {editingTodo && <AssignmentModal onClose={() => setEditingTodo(null)} onEditTodo={handleEditTodo} existingTodo={editingTodo} t={t} createAI={createAI} />}
            {infoTodo && <GoalInfoModal todo={infoTodo} onClose={() => setInfoTodo(null)} t={t} />}
            {isSettingsOpen && <SettingsModal 
                onClose={() => setIsSettingsOpen(false)} 
                isDarkMode={isDarkMode} 
                onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
                themeMode={themeMode}
                onThemeChange={handleThemeChange}
                backgroundTheme={backgroundTheme} 
                onSetBackgroundTheme={setBackgroundTheme} 
                onExportData={handleExportData} 
                onImportData={handleImportData} 
                setAlertConfig={setAlertConfig} 
                onDeleteAllData={handleDeleteAllData} 
                dataActionStatus={dataActionStatus} 
                language={language} 
                onSetLanguage={setLanguage} 
                t={t} 
                todos={todos} 
                setToastMessage={setToastMessage} 
                onOpenVersionInfo={() => setIsVersionInfoOpen(true)} 
                onOpenUsageGuide={() => setIsUsageGuideOpen(true)} 
                apiKey={apiKey} 
                onSetApiKey={setApiKey} 
                isOfflineMode={isOfflineMode} 
                onToggleOfflineMode={() => setIsOfflineMode(!isOfflineMode)}
                user={user}
                onGoogleLogin={handleGoogleLogin}
                onLogout={handleLogout}
            />}
            {isVersionInfoOpen && <VersionInfoModal onClose={() => setIsVersionInfoOpen(false)} t={t} />}
            {isUsageGuideOpen && <UsageGuideModal onClose={() => setIsUsageGuideOpen(false)} t={t} />}
            {alertConfig && <AlertModal title={alertConfig.title} message={alertConfig.message} onConfirm={() => { alertConfig.onConfirm?.(); setAlertConfig(null); }} onCancel={alertConfig.onCancel ? () => { alertConfig.onCancel?.(); setAlertConfig(null); } : undefined} confirmText={alertConfig.confirmText} cancelText={alertConfig.cancelText} isDestructive={alertConfig.isDestructive} t={t} />}
            {toastMessage && <div className="toast-notification">{toastMessage}</div>}
            {showPWAPrompt && <PWAInstallPrompt onClose={() => setShowPWAPrompt(false)} />}
        </div>
    );
};

const Header: React.FC<{ t: (key: string) => any; isSelectionMode: boolean; selectedCount: number; onCancelSelection: () => void; onDeleteSelected: () => void; isViewModeCalendar: boolean; onToggleViewMode: () => void; isAiSorting: boolean; sortType: string; onSort: (type: string) => void; filter: string; onFilter: (type: string) => void; onSetSelectionMode: () => void; onOpenSettings: () => void; onAddGoal: () => void; user: User | null; onSync: () => void; }> = ({ t, isSelectionMode, selectedCount, onCancelSelection, onDeleteSelected, isViewModeCalendar, onToggleViewMode, isAiSorting, sortType, onSort, filter, onFilter, onSetSelectionMode, onOpenSettings, onAddGoal, user, onSync }) => {
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

    useEffect(() => {
        const closePopovers = () => {
            setIsFilterPopoverOpen(false);
        };
        document.addEventListener('click', closePopovers);
        document.addEventListener('touchstart', closePopovers);
        return () => {
            document.removeEventListener('click', closePopovers);
            document.removeEventListener('touchstart', closePopovers);
        };
    }, []);

    const toggleFilterPopover = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setIsFilterPopoverOpen(prev => !prev);
    };

    const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
    };


    return (
        <header>
            <div className="header-left">
                {isSelectionMode && <button onClick={onCancelSelection} className="header-action-button">{t('cancel_selection_button_label')}</button>}
            </div>
            <div className="header-title-group">
                <h1>{t('my_assignments_title')}</h1>
                {!isSelectionMode && (
                    <div className="header-inline-actions" style={{ gap: '8px' }}>
                        <button onClick={onToggleViewMode} className="header-icon-button" style={{ transition: 'all 0.2s ease' }} aria-label={isViewModeCalendar ? t('list_view_button_aria') : t('calendar_view_button_aria')}>{isViewModeCalendar ? icons.list : icons.calendar}</button>
                        {user && <button onClick={onSync} className="header-icon-button" style={{ transition: 'all 0.2s ease' }} aria-label="동기화" title="클라우드 동기화">{icons.sync}</button>}
                        <div className="filter-sort-container">
                            <button onClick={toggleFilterPopover} onTouchStart={toggleFilterPopover} className="header-icon-button" style={{ transition: 'all 0.2s ease' }} aria-label={t('filter_sort_button_aria')}>{isAiSorting ? <div className="spinner" /> : icons.filter}</button>
                            {isFilterPopoverOpen && (
                                <div className="profile-popover filter-sort-popover" onClick={stopPropagation} onTouchStart={stopPropagation}>
                                    <div className="popover-section">
                                        <button onClick={() => { onSetSelectionMode(); setIsFilterPopoverOpen(false); }} className="popover-action-button"><span>{t('select_button_label')}</span></button>
                                    </div>
                                    <div className="popover-section">
                                        <h4>{t('filter_title')}</h4>
                                        <button onClick={() => { onFilter('all'); }} className={`popover-action-button ${filter === 'all' ? 'active' : ''}`}><span>{t('filter_all')}</span>{filter === 'all' && icons.check}</button>
                                        <button onClick={() => { onFilter('active'); }} className={`popover-action-button ${filter === 'active' ? 'active' : ''}`}><span>{t('filter_active')}</span>{filter === 'active' && icons.check}</button>
                                        <button onClick={() => { onFilter('completed'); }} className={`popover-action-button ${filter === 'completed' ? 'active' : ''}`}><span>{t('filter_completed')}</span>{filter === 'completed' && icons.check}</button>
                                    </div>
                                    <div className="popover-section">
                                        <h4>{t('sort_title')}</h4>
                                        <button onClick={() => { onSort('auto'); }} className={`popover-action-button ${sortType === 'auto' ? 'active' : ''}`}><span>{t('sort_label_auto')}</span>{sortType === 'auto' && icons.check}</button>
                                        <button onClick={() => { onSort('deadline'); }} className={`popover-action-button ${sortType === 'deadline' ? 'active' : ''}`}><span>{t('sort_label_deadline')}</span>{sortType === 'deadline' && icons.check}</button>
                                        <button onClick={() => { onSort('difficulty'); }} className={`popover-action-button ${sortType === 'difficulty' ? 'active' : ''}`}><span>{t('sort_label_difficulty')}</span>{sortType === 'difficulty' && icons.check}</button>
                                        <button onClick={() => { onSort('time'); }} className={`popover-action-button ${sortType === 'time' ? 'active' : ''}`}><span>{t('sort_label_time')}</span>{sortType === 'time' && icons.check}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={onOpenSettings} className="header-icon-button" style={{ transition: 'all 0.2s ease' }} aria-label={t('settings_title')}>{icons.settings}</button>
                    </div>
                )}
            </div>
            <div className="header-right">
                {isSelectionMode ? (
                    <button onClick={onDeleteSelected} className="header-action-button destructive">{t('delete_selected_button_label').replace('{count}', String(selectedCount))}</button>
                ) : (
                    <button onClick={onAddGoal} className="header-icon-button" style={{ transition: 'all 0.2s ease' }} aria-label={t('add_new_assignment_button')}>{icons.add}</button>
                )}
            </div>
        </header>
    );
};

const TodoList: React.FC<{ 
    todos: Goal[]; 
    todayAssignments: (Assignment & { todayTime: number; allocationCompleted: boolean })[]; 
    onToggleComplete: (id: number) => void; 
    onDelete: (id: number) => void; 
    onEdit: (todo: Goal) => void; 
    onInfo: (todo: Goal) => void; 
    t: (key: string) => any; 
    filter: string; 
    randomEncouragement: string; 
    isSelectionMode: boolean; 
    selectedTodoIds: Set<number>; 
    onSelectTodo: (id: number) => void; 
}> = ({ todos, todayAssignments, onToggleComplete, onDelete, onEdit, onInfo, t, filter, randomEncouragement, isSelectionMode, selectedTodoIds, onSelectTodo }) => {
    
    // 완료율 계산
    const completedCount = todos.filter(t => t.completed).length;
    const totalCount = todos.length;

    // 오늘 배정된 과제 중 오늘 완료하지 않은 것만 표시
    const today = new Date().toISOString().split('T')[0];
    const incompleteTodayAssignments = todayAssignments.filter(assignment => {
        const completedDates = assignment.completedDates || [];
        return !completedDates.includes(today);
    });

    // 오늘 배정된 과제가 있고 모두 완료했는지 확인
    const hasTodayAssignments = todayAssignments.length > 0;
    const allTodayCompleted = hasTodayAssignments && incompleteTodayAssignments.length === 0;

    // 오늘의 할당 과제 섹션
    const todaySection = hasTodayAssignments && (
        <div className="today-assignments-section">
            <h2 className="section-title">{t('today_schedule_title')} ({incompleteTodayAssignments.length}개)</h2>
            {incompleteTodayAssignments.length > 0 ? (
                <ul>
                    {incompleteTodayAssignments.map(assignment => (
                        <TodoItem 
                            key={`today-${assignment.id}`} 
                            todo={assignment} 
                            todayTime={assignment.todayTime}
                            showProgress={false}
                            showCheckbox={true}
                            onToggleComplete={onToggleComplete} 
                            onDelete={onDelete} 
                            onEdit={onEdit} 
                            onInfo={onInfo} 
                            t={t} 
                            isSelectionMode={isSelectionMode} 
                            isSelected={selectedTodoIds.has(assignment.id)} 
                            onSelect={onSelectTodo} 
                        />
                    ))}
                </ul>
            ) : (
                <div style={{ 
                    padding: '24px', 
                    textAlign: 'center', 
                    backgroundColor: 'var(--success-bg)', 
                    borderRadius: '12px',
                    margin: '12px 0'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--success-color)', marginBottom: '4px' }}>
                        모두 완료했습니다!
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        오늘 배정된 모든 과제를 완료했어요
                    </div>
                </div>
            )}
        </div>
    );

    // 전체 과제 목록 섹션
    if (todos.length === 0 && !hasTodayAssignments) {
        const messageKey = `empty_message_${filter}`;
        return <div className="empty-message"><p>{t(messageKey)}</p>{filter === 'all' && <span>{randomEncouragement}</span>}</div>;
    }

    return (
        <div>
            {todaySection}
            {todos.length > 0 && (
                <div className="all-assignments-section">
                    <h2 className="section-title">{t('all_assignments_title')} ({totalCount}개)</h2>
                    <ul>
                        {todos.map(todo => (
                            <TodoItem 
                                key={todo.id} 
                                todo={todo}
                                showProgress={true}
                                showCheckbox={false}
                                onToggleComplete={onToggleComplete} 
                                onDelete={onDelete} 
                                onEdit={onEdit} 
                                onInfo={onInfo} 
                                t={t} 
                                isSelectionMode={isSelectionMode} 
                                isSelected={selectedTodoIds.has(todo.id)} 
                                onSelect={onSelectTodo} 
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const TodoItem: React.FC<{ 
    todo: Assignment; 
    todayTime?: number;
    showProgress?: boolean;
    showCheckbox?: boolean;
    onToggleComplete: (id: number) => void; 
    onDelete: (id: number) => void; 
    onEdit: (todo: Goal) => void; 
    onInfo: (todo: Goal) => void; 
    t: (key: string) => any; 
    isSelectionMode: boolean; 
    isSelected: boolean; 
    onSelect: (id: number) => void; 
}> = React.memo(({ todo, todayTime, showProgress = true, showCheckbox = true, onToggleComplete, onDelete, onEdit, onInfo, t, isSelectionMode, isSelected, onSelect }) => {
    const handleItemClick = () => { if (isSelectionMode) onSelect(todo.id); };
    
    // 난이도를 별로 표시
    const difficultyStars = '⭐'.repeat(todo.difficulty);
    
    // 오늘 완료 여부 확인
    const today = new Date().toISOString().split('T')[0];
    const completedDates = todo.completedDates || [];
    const isCompletedToday = completedDates.includes(today);
    
    // 프로그레스 바 계산 로직
    const calculateProgress = () => {
        if (!todo.deadline) return 0;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(todo.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        
        // 총 일수 계산 (과제 생성일 ~ 마감일)
        // completedDates가 있으면 첫 완료일을 시작일로, 없으면 오늘을 시작일로
        const completedDates = todo.completedDates || [];
        const startDate = completedDates.length > 0 
            ? new Date(Math.min(...completedDates.map(d => new Date(d).getTime())))
            : today;
        startDate.setHours(0, 0, 0, 0);
        
        const totalDays = Math.ceil((deadlineDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // 완료한 날짜 수
        const completedDays = completedDates.length;
        
        // 프로그레스 계산
        if (totalDays <= 0) return 100; // 마감일 지남
        const progress = Math.min(100, Math.round((completedDays / totalDays) * 100));
        
        return progress;
    };
    
    const progressRate = calculateProgress();
    
    // D-day 계산
    const getDdayText = (deadline: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        const diffTime = deadlineDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return `⚠️ D+${Math.abs(diffDays)}`;
        if (diffDays === 0) return '🔥 D-Day';
        return `📅 D-${diffDays}`;
    };
    
    return (
        <li className={`${todo.completed ? 'completed' : ''} ${isSelectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`} onClick={handleItemClick}>
            <div className="swipeable-content">
                {showCheckbox && (
                    <label className="checkbox-container" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={todo.completed} onChange={() => onToggleComplete(todo.id)} />
                        <span className="checkmark"></span>
                    </label>
                )}
                <div className="todo-text-with-info" style={{ flex: 1, marginLeft: showCheckbox ? '0' : '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="todo-text">{todo.title}</span>
                        {!showCheckbox && isCompletedToday && (
                            <span style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: '600',
                                borderRadius: '12px'
                            }}>
                                ✓ 완료
                            </span>
                        )}
                    </div>
                    <div className="assignment-meta">
                        <span className="assignment-subject">{todo.subject}</span>
                        <span className="assignment-difficulty">{difficultyStars}</span>
                    </div>
                    <div className="assignment-meta" style={{ marginTop: '4px' }}>
                        {todo.deadline && <span className="todo-deadline" style={{ fontWeight: '600', fontSize: '13px' }}>{getDdayText(todo.deadline)}</span>}
                        {todayTime && <span className="assignment-time">⏰ 오늘 {todayTime}시간</span>}
                        {!todayTime && <span className="assignment-total-time">⏱️ 총 {todo.estimatedTime}시간</span>}
                    </div>
                    {/* 과제별 프로그레스 바 - 전체 과제 목록에만 표시 */}
                    {showProgress && (
                        <div style={{ marginTop: '8px', width: '100%' }}>
                            <div style={{ 
                                width: '100%', 
                                height: '6px', 
                                backgroundColor: 'var(--border-color)', 
                                borderRadius: '3px', 
                                overflow: 'hidden' 
                            }}>
                                <div style={{ 
                                    width: `${progressRate}%`, 
                                    height: '100%', 
                                    backgroundColor: progressRate === 100 ? '#10b981' : '#3b82f6', 
                                    transition: 'width 0.3s ease, background-color 0.3s ease',
                                    borderRadius: '3px'
                                }} />
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', textAlign: 'right' }}>
                                {progressRate}% 완료
                            </div>
                        </div>
                    )}
                </div>
                <div className="todo-actions-and-meta">
                    <div className="todo-buttons">
                        {!showCheckbox && isCompletedToday && (
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onToggleComplete(todo.id); 
                                }} 
                                className="info-button"
                                style={{
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    borderRadius: '6px',
                                    border: 'none'
                                }}
                                aria-label="완료 해제"
                            >
                                ✕
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onEdit(todo); }} className="info-button edit-button" aria-label={t('edit_button_aria')}>{icons.edit}</button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }} className="delete-button" aria-label={t('delete_button')}>{icons.delete}</button>
                        <button onClick={(e) => { e.stopPropagation(); onInfo(todo); }} className="info-button" aria-label={t('info_button_aria')}>{icons.info}</button>
                    </div>
                </div>
            </div>
        </li>
    );
});

const Modal: React.FC<{ onClose: () => void; children: React.ReactNode; className?: string; isClosing: boolean }> = ({ onClose, children, className = '', isClosing }) => (
    <div className={`modal-backdrop ${isClosing ? 'is-closing' : ''}`} onClick={onClose}>
        <div className={`modal-content ${className} ${isClosing ? 'is-closing' : ''}`} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
);

const useModalAnimation = (onClose: () => void): [boolean, () => void] => {
    const [isClosing, setIsClosing] = useState(false);
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 500);
    };
    return [isClosing, handleClose];
};

const GoalAssistantStepContent: React.FC<{ step: number; t: (key: string) => any; createAI: () => OpenAI | null; [key: string]: any }> = ({ step, t, createAI, ...props }) => {
    const { wish, setWish, outcome, setOutcome, obstacle, setObstacle, plan, setPlan, isRecurring, setIsRecurring, recurringDays, setRecurringDays, deadline, setDeadline, noDeadline, setNoDeadline, errors, language } = props;
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState('');
    const [aiError, setAiError] = useState('');

    const getAIFeedback = async (fieldName: string, value: string) => {
        if (!value) return;
        setIsAiLoading(true);
        setAiFeedback('');
        setAiError('');
        try {
            const ai = createAI();
            if (!ai) {
                setAiError('AI 기능을 사용하려면 설정에서 API 키를 입력해주세요.');
                setIsAiLoading(false);
                return;
            }
            
            const prompt = `Provide concise, actionable feedback on this part of a WOOP goal: ${fieldName} - "${value}". The feedback should be helpful and encouraging, in ${language === 'ko' ? 'Korean' : 'English'}. Keep it to 1-2 sentences.`;
            const response = await ai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: '당신은 목표 설정 코치입니다. 사용자의 목표에 대해 간결하고 실천 가능한 피드백을 제공합니다.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 150
            });
            setAiFeedback(response.choices[0].message.content || '피드백을 생성할 수 없습니다.');
        } catch (error) {
            console.error('AI Feedback Error:', error);
            setAiError('Failed to get AI feedback.');
        } finally {
            setIsAiLoading(false);
        }
    };
    
    switch (step) {
        case 1: return (<div><h3>{t('wish_label')}</h3><div className="step-guidance"><p className="tip">{t('wish_tip')}</p><p className="example">{t('wish_example')}</p></div><textarea value={wish} onChange={(e) => { setWish(e.target.value); setAiFeedback(''); setAiError(''); }} placeholder={t('wish_label')} className={errors.wish ? 'input-error' : ''} rows={3} />{errors.wish && <p className="field-error-message">{icons.exclamation} {t('error_wish_required')}</p>}<div className="ai-feedback-section"><button onClick={() => getAIFeedback('Wish', wish)} disabled={!wish.trim() || isAiLoading} className="ai-feedback-button">{isAiLoading ? <div className="spinner-small" /> : '🤖'}<span>{isAiLoading ? t('ai_analyzing') : t('ai_coach_suggestion')}</span></button>{aiFeedback && <div className="ai-feedback-bubble">{aiFeedback}</div>}{aiError && <div className="ai-feedback-bubble error">{aiError}</div>}</div></div>);
        case 2: return (<div><h3>{t('outcome_label')}</h3><div className="step-guidance"><p className="tip">{t('outcome_tip')}</p><p className="example">{t('outcome_example')}</p></div><textarea value={outcome} onChange={(e) => { setOutcome(e.target.value); setAiFeedback(''); setAiError(''); }} placeholder={t('outcome_label')} className={errors.outcome ? 'input-error' : ''} rows={3} />{errors.outcome && <p className="field-error-message">{icons.exclamation} {t('error_outcome_required')}</p>}<div className="ai-feedback-section"><button onClick={() => getAIFeedback('Outcome', outcome)} disabled={!outcome.trim() || isAiLoading} className="ai-feedback-button">{isAiLoading ? <div className="spinner-small" /> : '🤖'}<span>{isAiLoading ? t('ai_analyzing') : t('ai_coach_suggestion')}</span></button>{aiFeedback && <div className="ai-feedback-bubble">{aiFeedback}</div>}{aiError && <div className="ai-feedback-bubble error">{aiError}</div>}</div></div>);
        case 3: return (<div><h3>{t('obstacle_label')}</h3><div className="step-guidance"><p className="tip">{t('obstacle_tip')}</p><p className="example">{t('obstacle_example')}</p></div><textarea value={obstacle} onChange={(e) => { setObstacle(e.target.value); setAiFeedback(''); setAiError(''); }} placeholder={t('obstacle_label')} className={errors.obstacle ? 'input-error' : ''} rows={3} />{errors.obstacle && <p className="field-error-message">{icons.exclamation} {t('error_obstacle_required')}</p>}<div className="ai-feedback-section"><button onClick={() => getAIFeedback('Obstacle', obstacle)} disabled={!obstacle.trim() || isAiLoading} className="ai-feedback-button">{isAiLoading ? <div className="spinner-small" /> : '🤖'}<span>{isAiLoading ? t('ai_analyzing') : t('ai_coach_suggestion')}</span></button>{aiFeedback && <div className="ai-feedback-bubble">{aiFeedback}</div>}{aiError && <div className="ai-feedback-bubble error">{aiError}</div>}</div></div>);
        case 4: return (<div><h3>{t('plan_label')}</h3><div className="step-guidance"><p className="tip">{t('plan_tip')}</p><p className="example">{t('plan_example')}</p></div><textarea value={plan} onChange={(e) => { setPlan(e.target.value); setAiFeedback(''); setAiError(''); }} placeholder={t('plan_label')} className={errors.plan ? 'input-error' : ''} rows={3} />{errors.plan && <p className="field-error-message">{icons.exclamation} {t('error_plan_required')}</p>}<div className="ai-feedback-section"><button onClick={() => getAIFeedback('Plan', plan)} disabled={!plan.trim() || isAiLoading} className="ai-feedback-button">{isAiLoading ? <div className="spinner-small" /> : '🤖'}<span>{isAiLoading ? t('ai_analyzing') : t('ai_coach_suggestion')}</span></button>{aiFeedback && <div className="ai-feedback-bubble">{aiFeedback}</div>}{aiError && <div className="ai-feedback-bubble error">{aiError}</div>}</div></div>);
        case 5:
            const toggleDay = (dayIndex: number) => {
                const newDays = [...recurringDays];
                const pos = newDays.indexOf(dayIndex);
                if (pos > -1) newDays.splice(pos, 1);
                else newDays.push(dayIndex);
                setRecurringDays(newDays);
            };
            return (<div><h3>{t('recurrence_label')} & {t('deadline_label')}</h3>
                <div className="step-guidance"><p className="tip">{t('recurrence_tip')}</p><p className="example">{t('recurrence_example')}</p></div>
                <label className="settings-item standalone-toggle"><span style={{ fontWeight: 500 }}>{t('recurrence_option_daily')}</span><label className="theme-toggle-switch"><input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} /><span className="slider round"></span></label></label>
                {isRecurring && <div className="day-picker">{t('day_names_short_picker').map((day, i) => <button key={i} onClick={() => toggleDay(i)} className={`day-button ${recurringDays.includes(i) ? 'selected' : ''}`}>{day}</button>)}</div>}
                {errors.recurringDays && <p className="field-error-message">{icons.exclamation} {t('error_day_required')}</p>}
                <hr />
                <div className="step-guidance" style={{ marginTop: '16px' }}><p className="tip">{t('deadline_tip')}</p></div>
                <label className="settings-item standalone-toggle"><span style={{ fontWeight: 500 }}>{t('deadline_option_no_deadline')}</span><label className="theme-toggle-switch"><input type="checkbox" checked={noDeadline} onChange={(e) => setNoDeadline(e.target.checked)} /><span className="slider round"></span></label></label>
                {!noDeadline && <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={errors.deadline ? 'input-error' : ''} style={{ marginTop: '12px' }} />}
                {errors.deadline && <p className="field-error-message">{icons.exclamation} {t('error_deadline_required')}</p>}
            </div>);
        default: return null;
    }
};

const AutomationForm: React.FC<{ onGenerate: (goals: Omit<Goal, 'id' | 'completed' | 'lastCompletedDate' | 'streak'>[]) => void; t: (key: string) => any }> = ({ onGenerate, t }) => {
    const [baseName, setBaseName] = useState('');
    const [totalUnits, setTotalUnits] = useState('');
    const [unitsPerDay, setUnitsPerDay] = useState('');
    const [startDate, setStartDate] = useState('');
    const [error, setError] = useState('');

    const { endDate, generatedCount } = useMemo(() => {
        const units = parseInt(totalUnits, 10);
        const daily = parseInt(unitsPerDay, 10);
        if (!startDate || !units || units <= 0 || !daily || daily <= 0) {
            return { endDate: '', generatedCount: 0 };
        }
        const numGoals = Math.ceil(units / daily);
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + numGoals - 1);
        const endDateString = end.toISOString().split('T')[0];
        return { endDate: endDateString, generatedCount: numGoals };
    }, [totalUnits, unitsPerDay, startDate]);

    const handleGenerate = () => {
        const units = parseInt(totalUnits, 10);
        const daily = parseInt(unitsPerDay, 10);
        if (!baseName.trim() || !startDate || !units || units <= 0 || !daily || daily <= 0) {
            setError(t('automation_error_all_fields'));
            return;
        }

        const newGoals = [];
        const numGoals = Math.ceil(units / daily);
        const start = new Date(startDate);
        
        for (let i = 0; i < numGoals; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            
            const startUnit = (i * daily) + 1;
            const endUnit = Math.min((i + 1) * daily, units);
            
            const wish = `${baseName.trim()} ${startUnit}` + (endUnit > startUnit ? ` - ${endUnit}` : '');
            
            newGoals.push({
                wish,
                outcome: '',
                obstacle: '',
                plan: '',
                isRecurring: false,
                recurringDays: [],
                deadline: currentDate.toISOString().split('T')[0],
            });
        }
        
        setError('');
        onGenerate(newGoals);
    };

    return (
        <div className="automation-form-container">
            <h3>{t('automation_title')}</h3>
            <div className="form-group">
                <label>{t('automation_base_name_label')}</label>
                <input type="text" value={baseName} onChange={(e) => setBaseName(e.target.value)} placeholder={t('automation_base_name_placeholder')} />
            </div>
            <div className="automation-form-grid">
                <div className="form-group">
                    <label>{t('automation_total_units_label')}</label>
                    <input type="number" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} placeholder={t('automation_total_units_placeholder')} />
                </div>
                 <div className="form-group">
                    <label>{t('automation_units_per_day_label')}</label>
                    <input type="number" value={unitsPerDay} onChange={(e) => setUnitsPerDay(e.target.value)} placeholder="예: 5" />
                </div>
            </div>
             <div className="automation-form-grid">
                <div className="form-group">
                    <label>{t('automation_start_date_label')}</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>{t('automation_end_date_label')}</label>
                    <input type="date" value={endDate} readOnly />
                </div>
            </div>
            {error && <p className="field-error-message" style={{justifyContent: 'center'}}>{icons.exclamation} {error}</p>}
             <div className="goal-assistant-nav">
                <button onClick={handleGenerate} className="primary" disabled={generatedCount === 0}>
                    {t('automation_generate_button').replace('{count}', String(generatedCount))}
                </button>
            </div>
        </div>
    );
};

// 과제 입력 모달 (간단한 폼)
const AssignmentModal: React.FC<{
    onClose: () => void;
    onAddTodo?: (newTodoData: Omit<Assignment, 'id' | 'completed' | 'totalAllocatedTime'>) => void;
    onEditTodo?: (updatedTodo: Assignment) => void;
    existingTodo?: Assignment;
    t: (key: string) => any;
    createAI: () => OpenAI | null;
}> = ({ onClose, onAddTodo, onEditTodo, existingTodo, t, createAI }) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);
    const [title, setTitle] = useState(existingTodo?.title || '');
    const [subject, setSubject] = useState(existingTodo?.subject || '');
    const [description, setDescription] = useState(existingTodo?.description || '');
    const [estimatedTime, setEstimatedTime] = useState(existingTodo?.estimatedTime?.toString() || '');
    const [difficulty, setDifficulty] = useState(existingTodo?.difficulty || 3);
    const [deadline, setDeadline] = useState(existingTodo?.deadline || '');
    const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

    const validate = () => {
        const newErrors: { [key: string]: boolean } = {};
        if (!title.trim()) newErrors.title = true;
        if (!subject.trim()) newErrors.subject = true;
        if (!estimatedTime || parseInt(estimatedTime) <= 0) newErrors.estimatedTime = true;
        if (!deadline) newErrors.deadline = true;
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAiAnalyze = async () => {
        if (!title.trim() || !subject.trim()) {
            alert('과제명과 과목을 먼저 입력해주세요.');
            return;
        }

        setIsAiAnalyzing(true);
        try {
            const ai = createAI();
            if (!ai) {
                alert('AI 분석을 사용하려면 설정에서 API 키를 입력해주세요.');
                setIsAiAnalyzing(false);
                return;
            }

            const prompt = `다음 과제 정보를 분석하여 난이도(1-5)와 예상 소요시간(분)을 추정해주세요:
- 과제명: ${title}
- 과목: ${subject}
${description ? `- 설명: ${description}` : ''}

JSON 형식으로만 응답해주세요:
{
  "difficulty": 1-5 사이의 숫자,
  "estimatedTime": 분 단위 숫자,
  "reason": "간단한 분석 이유"
}`;

            const response = await ai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: '당신은 과제 분석 전문가입니다. 주어진 과제 정보를 바탕으로 난이도와 예상 소요시간을 정확하게 추정합니다.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7
            });

            const result = JSON.parse(response.choices[0].message.content || '{}');
            setDifficulty(result.difficulty);
            setEstimatedTime(result.estimatedTime.toString());
            setIsAiAnalyzing(false);
        } catch (error) {
            console.error('AI 분석 실패:', error);
            alert('AI 분석에 실패했습니다. 다시 시도해주세요.');
            setIsAiAnalyzing(false);
        }
    };

    const handleSubmit = () => {
        if (!validate()) return;

        const assignmentData = {
            title: title.trim(),
            subject: subject.trim(),
            description: description.trim() || undefined,
            estimatedTime: parseInt(estimatedTime),
            difficulty,
            deadline
        };

        if (existingTodo && onEditTodo) {
            onEditTodo({ ...existingTodo, ...assignmentData });
        } else if (onAddTodo) {
            onAddTodo(assignmentData);
        }
    };

    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="assignment-modal">
            <div className="goal-assistant-header">
                <h2>{existingTodo ? t('edit_assignment_modal_title') : t('new_assignment_modal_title')}</h2>
                <button onClick={handleClose} className="close-button">{icons.close}</button>
            </div>

            <div className="goal-assistant-body assignment-form">
                <div className="form-group">
                    <label>{t('assignment_title_label')}</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => { setTitle(e.target.value); setErrors({ ...errors, title: false }); }}
                        placeholder={t('assignment_title_placeholder')}
                        className={errors.title ? 'input-error' : ''}
                    />
                    {errors.title && <p className="field-error-message">{icons.exclamation} {t('error_title_required')}</p>}
                </div>

                <div className="form-group">
                    <label>{t('subject_label')}</label>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => { setSubject(e.target.value); setErrors({ ...errors, subject: false }); }}
                        placeholder={t('subject_placeholder')}
                        className={errors.subject ? 'input-error' : ''}
                    />
                    {errors.subject && <p className="field-error-message">{icons.exclamation} {t('error_subject_required')}</p>}
                </div>

                <div className="form-group">
                    <label>{t('description_label')}</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('description_placeholder')}
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                        }}
                    />
                </div>

                <div className="form-group">
                    <label>{t('estimated_time_label')}</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="number"
                            value={estimatedTime}
                            onChange={(e) => { setEstimatedTime(e.target.value); setErrors({ ...errors, estimatedTime: false }); }}
                            placeholder={t('estimated_time_placeholder')}
                            className={errors.estimatedTime ? 'input-error' : ''}
                            min="1"
                            style={{ paddingRight: '40px' }}
                        />
                        <span style={{ 
                            position: 'absolute', 
                            right: '12px', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)',
                            pointerEvents: 'none'
                        }}>분</span>
                    </div>
                    {errors.estimatedTime && <p className="field-error-message">{icons.exclamation} {t('error_time_required')}</p>}
                </div>

                <div className="form-group">
                    <label>{t('difficulty_label')}</label>
                    <div className="difficulty-selector" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '8px',
                        marginTop: '8px'
                    }}>
                        {[1, 2, 3, 4, 5].map(level => (
                            <button
                                key={level}
                                type="button"
                                className={`difficulty-button ${difficulty === level ? 'selected' : ''}`}
                                onClick={() => setDifficulty(level)}
                                style={{
                                    padding: '12px',
                                    border: difficulty === level ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    backgroundColor: difficulty === level ? 'var(--primary-color)' : 'transparent',
                                    color: difficulty === level ? 'white' : 'var(--text-primary)',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                    <p style={{ 
                        marginTop: '8px', 
                        fontSize: '13px', 
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                    }}>{t(`difficulty_${difficulty}`)}</p>
                </div>

                <div className="form-group">
                    <label>{t('deadline_label')}</label>
                    <input
                        type="date"
                        value={deadline}
                        onChange={(e) => { setDeadline(e.target.value); setErrors({ ...errors, deadline: false }); }}
                        className={errors.deadline ? 'input-error' : ''}
                    />
                    {errors.deadline && <p className="field-error-message">{icons.exclamation} {t('error_deadline_required')}</p>}
                </div>

                {/* AI 분석 버튼 */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginTop: '16px' 
                }}>
                    <button
                        type="button"
                        onClick={handleAiAnalyze}
                        disabled={isAiAnalyzing || !title.trim() || !subject.trim()}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: isAiAnalyzing ? 'var(--border-color)' : 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: isAiAnalyzing || !title.trim() || !subject.trim() ? 'not-allowed' : 'pointer',
                            opacity: isAiAnalyzing || !title.trim() || !subject.trim() ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {isAiAnalyzing ? '🤖 ' + t('ai_analyzing') : '✨ ' + t('ai_analyze_button')}
                    </button>
                </div>
            </div>

            <div className="modal-buttons" style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                marginTop: '24px'
            }}>
                <button 
                    onClick={handleClose} 
                    className="circular-button secondary"
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        border: '2px solid var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    aria-label={t('cancel_button')}
                >
                    ✕
                </button>
                <button 
                    onClick={handleSubmit} 
                    className="circular-button primary"
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        border: 'none',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        fontSize: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                    }}
                    aria-label={existingTodo ? t('save_button') : t('add_button')}
                >
                    ✓
                </button>
            </div>
        </Modal>
    );
};

const GoalAssistantModal: React.FC<{ onClose: () => void; onAddTodo?: (newTodoData: Omit<Goal, 'id' | 'completed' | 'totalAllocatedTime'>) => void; onAddMultipleTodos?: (newTodosData: Omit<Goal, 'id' | 'completed' | 'totalAllocatedTime'>[]) => void; onEditTodo?: (updatedTodo: Goal) => void; existingTodo?: Goal; t: (key: string) => any; language: string; createAI: () => OpenAI | null; }> = ({ onClose, onAddTodo, onAddMultipleTodos, onEditTodo, existingTodo, t, language, createAI }) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);
    
    // 간단히 AssignmentModal로 리다이렉트
    return <AssignmentModal onClose={onClose} onAddTodo={onAddTodo} onEditTodo={onEditTodo} existingTodo={existingTodo} t={t} createAI={createAI} />;
};

const GoalInfoModal: React.FC<{ todo: Goal; onClose: () => void; t: (key: string) => any; }> = ({ todo, onClose, t }) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);

    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="info-modal">
            <div className="info-modal-content">
                <h2>{t('goal_details_modal_title')}</h2>
                <div className="info-section"><h4>{t('assignment_title_label')}</h4><p>{todo.title}</p></div>
                <div className="info-section"><h4>{t('subject_label')}</h4><p>{todo.subject}</p></div>
                {todo.description && <div className="info-section"><h4>{t('description_label')}</h4><p>{todo.description}</p></div>}
                <div className="info-section"><h4>{t('estimated_time_label')}</h4><p>{todo.estimatedTime}분</p></div>
                <div className="info-section"><h4>{t('difficulty_label')}</h4><p>{'⭐'.repeat(todo.difficulty)}</p></div>
                {todo.deadline && <div className="info-section"><h4>{t('deadline_label')}</h4><p>{new Date(todo.deadline).toLocaleDateString()}</p></div>}
            </div>
            <div className="modal-buttons"><button onClick={handleClose} className="primary">{t('close_button')}</button></div>
        </Modal>
    );
};

const SettingsModal: React.FC<{
    onClose: () => void;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
    themeMode: 'light' | 'dark' | 'system';
    onThemeChange: (mode: 'light' | 'dark' | 'system') => void;
    backgroundTheme: string;
    onSetBackgroundTheme: (theme: string) => void;
    onExportData: () => void;
    onImportData: (event: React.ChangeEvent<HTMLInputElement>) => void;
    setAlertConfig: (config: any) => void;
    onDeleteAllData: () => void;
    dataActionStatus: 'idle' | 'importing' | 'exporting' | 'deleting';
    language: string;
    onSetLanguage: (lang: string) => void;
    t: (key: string) => any;
    todos: Goal[];
    setToastMessage: (message: string) => void;
    onOpenVersionInfo: () => void;
    onOpenUsageGuide: () => void;
    apiKey: string;
    onSetApiKey: (key: string) => void;
    isOfflineMode: boolean;
    onToggleOfflineMode: () => void;
    user: User | null;
    onGoogleLogin: () => void;
    onLogout: () => void;
}> = ({
    onClose, isDarkMode, onToggleDarkMode, themeMode, onThemeChange, backgroundTheme, onSetBackgroundTheme,
    onExportData, onImportData, setAlertConfig, onDeleteAllData, dataActionStatus,
    language, onSetLanguage, t, todos, setToastMessage, onOpenVersionInfo, onOpenUsageGuide,
    apiKey, onSetApiKey, isOfflineMode, onToggleOfflineMode, user, onGoogleLogin, onLogout
}) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);
    const [activeTab, setActiveTab] = useState('appearance');
    const [shareableLink, setShareableLink] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const tabs = [
        { id: 'appearance', label: t('settings_section_background'), icon: icons.background },
        { id: 'general', label: t('settings_section_general'), icon: icons.settings },
        { id: 'data', label: t('settings_section_data'), icon: icons.data },
    ];

    const handleDeleteClick = () => setAlertConfig({ 
        title: t('delete_account_header'), 
        message: t('delete_account_header_desc'), 
        isDestructive: true, 
        confirmText: t('delete_all_data_button'), 
        cancelText: t('cancel_button'), 
        onConfirm: onDeleteAllData,
        onCancel: () => {}
    });

    const handleCreateShareLink = async () => {
        // 데이터가 없는지 확인
        if (!todos || todos.length === 0) {
            alert(t('no_data_to_share'));
            return;
        }
        
        setIsGeneratingLink(true);
        
        try {
            // 데이터 압축 및 인코딩
            const encodedData = compressDataForUrl(todos);
            const longUrl = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(encodedData)}`;
            
            // 단축 URL 생성 시도 (길이가 긴 경우만)
            const finalUrl = await createShortUrl(longUrl);
            setShareableLink(finalUrl);
            
            // 단축 URL이 생성되었는지 확인하고 토스트 메시지 표시
            if (finalUrl !== longUrl && finalUrl.length < longUrl.length) {
                setToastMessage(t('short_url_created'));
            } else {
                setToastMessage(t('share_link_created'));
            }
        } catch (e) {
            console.error("Failed to create share link", e);
            // 실패 시 기본 URL 사용
            const encodedData = compressDataForUrl(todos);
            const url = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(encodedData)}`;
            setShareableLink(url);
            setToastMessage(t('short_url_failed'));
        } finally {
            setIsGeneratingLink(false);
        }
    };

    const handleCopyLink = () => {
        if (shareableLink) {
            navigator.clipboard.writeText(shareableLink).then(() => {
                setToastMessage(t('link_copied_toast'));
            });
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'appearance':
                return (
                    <>
                        <div className="settings-section-header">테마 모드</div>
                        <div className="settings-section-body">
                            <div className="settings-item nav-indicator" onClick={() => onThemeChange('light')}>
                                <div>
                                    <span>라이트 모드</span>
                                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>항상 밝은 테마 사용</div>
                                </div>
                                {themeMode === 'light' && icons.check}
                            </div>
                            <div className="settings-item nav-indicator" onClick={() => onThemeChange('dark')}>
                                <div>
                                    <span>다크 모드</span>
                                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>항상 어두운 테마 사용</div>
                                </div>
                                {themeMode === 'dark' && icons.check}
                            </div>
                            <div className="settings-item nav-indicator" onClick={() => onThemeChange('system')}>
                                <div>
                                    <span>시스템 설정 따라가기</span>
                                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>기기의 다크모드 설정에 맞춰 자동 변경</div>
                                </div>
                                {themeMode === 'system' && icons.check}
                            </div>
                        </div>
                        <div className="settings-section-header">{t('settings_background_header')}</div>
                        <div className="settings-section-body">
                           {backgroundOptions.map(option => (
                                <div key={option.id} className="settings-item nav-indicator" onClick={() => onSetBackgroundTheme(option.id)}>
                                    <span>{t(isDarkMode ? option.darkNameKey : option.lightNameKey)}</span>
                                    {backgroundTheme === option.id && icons.check}
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'general':
                return (
                    <>
                        <div className="settings-section-header">계정</div>
                        <div className="settings-section-body">
                            {user ? (
                                <>
                                    <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                            {user.photoURL && (
                                                <img 
                                                    src={user.photoURL} 
                                                    alt="Profile" 
                                                    style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                                                />
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '600' }}>{user.displayName || '사용자'}</div>
                                                <div style={{ fontSize: '13px', opacity: 0.7 }}>{user.email}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        className="settings-item action-item" 
                                        onClick={onLogout}
                                        style={{ justifyContent: 'center' }}
                                    >
                                        <span className="action-text">로그아웃</span>
                                    </button>
                                </>
                            ) : (
                                <button 
                                    className="settings-item action-item" 
                                    onClick={onGoogleLogin}
                                    style={{ justifyContent: 'center', backgroundColor: 'var(--primary-color)', color: 'white' }}
                                >
                                    <span className="action-text">🔐 Google로 로그인</span>
                                </button>
                            )}
                        </div>
                        <div className="settings-section-header">{t('settings_api_key')}</div>
                        <div className="settings-section-body">
                            <div className="settings-item">
                                <input
                                    type="password"
                                    placeholder={t('settings_api_key_placeholder')}
                                    value={apiKey}
                                    onChange={(e) => onSetApiKey(e.target.value)}
                                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--input-bg)' }}
                                />
                            </div>
                            <label className="settings-item">
                                <div>
                                    <span>{t('settings_offline_mode')}</span>
                                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>{t('settings_offline_mode_desc')}</div>
                                </div>
                                <div className="theme-toggle-switch">
                                    <input type="checkbox" checked={isOfflineMode} onChange={onToggleOfflineMode} />
                                    <span className="slider round"></span>
                                </div>
                            </label>
                        </div>
                        <div className="settings-section-header">{t('settings_language')}</div>
                        <div className="settings-section-body">
                            <div className="settings-item nav-indicator" onClick={() => onSetLanguage('ko')}><span>한국어</span>{language === 'ko' && icons.check}</div>
                            <div className="settings-item nav-indicator" onClick={() => onSetLanguage('en')}><span>English</span>{language === 'en' && icons.check}</div>
                        </div>
                        <div className="settings-section-header">{t('settings_section_info')}</div>
                        <div className="settings-section-body">
                            <div className="settings-item nav-indicator" onClick={onOpenVersionInfo}>
                                <span>{t('settings_version')}</span>
                                <div className="settings-item-value-with-icon">
                                    <span>1.2</span>
                                    {icons.forward}
                                </div>
                            </div>
                            <div className="settings-item nav-indicator" onClick={onOpenUsageGuide}>
                                <span>{t('usage_guide_title')}</span>
                                <div className="settings-item-value-with-icon">
                                    {icons.forward}
                                </div>
                            </div>
                            <div className="settings-item">
                                <span>{t('settings_developer')}</span>
                                <span className="settings-item-value">{t('developer_name')}</span>
                            </div>
                             <div className="settings-item">
                                <span>{t('settings_copyright')}</span>
                                <span className="settings-item-value">{t('copyright_notice')}</span>
                            </div>
                        </div>
                    </>
                );
            case 'data':
                return (
                    <>
                        <div className="settings-section-header">{t('settings_data_header')}</div>
                        <div className="settings-section-body">
                            <button className="settings-item action-item" onClick={onExportData} disabled={dataActionStatus !== 'idle'}><span className="action-text">{dataActionStatus === 'exporting' ? t('data_exporting') : t('settings_export_data')}</span></button>
                            <button className="settings-item action-item" onClick={() => fileInputRef.current?.click()} disabled={dataActionStatus !== 'idle'}><span className="action-text">{dataActionStatus === 'importing' ? t('data_importing') : t('settings_import_data')}</span><input type="file" ref={fileInputRef} onChange={onImportData} accept=".json" style={{ display: 'none' }} /></button>
                        </div>

                        <div className="settings-section-header">{t('settings_share_link_header')}</div>
                        <div className="settings-section-body">
                            {!shareableLink && (
                                <button 
                                    className="settings-item action-item" 
                                    onClick={handleCreateShareLink}
                                    disabled={isGeneratingLink}
                                >
                                    <span className="action-text">
                                        {isGeneratingLink ? '🔗 단축 URL 생성 중...' : t('settings_generate_link')}
                                    </span>
                                </button>
                            )}
                            {shareableLink && (
                                <div className="share-link-container">
                                    <div style={{ marginBottom: '8px', fontSize: '12px', opacity: 0.7 }}>
                                        {shareableLink.length < 100 ? '📎 단축 URL' : '🔗 일반 링크'} 
                                        ({shareableLink.length}자)
                                    </div>
                                    <input type="text" readOnly value={shareableLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                                    <button onClick={handleCopyLink}>{t('settings_copy_link')}</button>
                                </div>
                            )}
                        </div>

                        <div className="settings-section-header">{t('settings_delete_account')}</div>
                        <div className="settings-section-body">
                            <button className="settings-item action-item" onClick={handleDeleteClick} disabled={dataActionStatus !== 'idle'}>
                                <span className="action-text destructive">{dataActionStatus === 'deleting' ? t('data_deleting') : t('settings_delete_account')}</span>
                            </button>
                        </div>
                    </>
                );
            default: return null;
        }
    }
    
    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="settings-modal">
            <div className="settings-modal-header">
                <div />
                <h2>{t('settings_title')}</h2>
                <div className="settings-modal-header-right">
                    <button onClick={handleClose} className="close-button">{icons.close}</button>
                </div>
            </div>
            <div className="settings-modal-body">
                <div className="settings-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`settings-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            aria-label={tab.label}
                        >
                            <div className="settings-tab-icon">{tab.icon}</div>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div className="settings-tab-content-container">
                    <div className="settings-tab-content" key={activeTab}>
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const VersionInfoModal: React.FC<{ onClose: () => void; t: (key: string) => any; }> = ({ onClose, t }) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);
    const buildNumber = "1.2 (25.10.20)";

    const changelogItems = [
        { icon: icons.ai, titleKey: 'version_update_1_title', descKey: 'version_update_1_desc' },
        { icon: icons.globe, titleKey: 'version_update_2_title', descKey: 'version_update_2_desc' },
        { icon: icons.background, titleKey: 'version_update_3_title', descKey: 'version_update_3_desc' },
    ];

    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="version-info-modal">
            {/* 버전 정보 섹션 */}
            <div className="version-info-header">
                <h2>{t('version_update_title')}</h2>
                <p>{t('build_number')}: {buildNumber}</p>
            </div>
            
            <div className="version-info-body">
                {changelogItems.map((item, index) => (
                    <div className="changelog-item" key={index}>
                        <div className="changelog-icon" style={{'--icon-bg': 'var(--primary-color)'} as React.CSSProperties}>{item.icon}</div>
                        <div className="changelog-text">
                            <h3>{t(item.titleKey)}</h3>
                            <p>{t(item.descKey)}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="modal-buttons">
                <button onClick={handleClose} className="primary">{t('settings_done_button')}</button>
            </div>
        </Modal>
    );
};

const UsageGuideModal: React.FC<{ onClose: () => void; t: (key: string) => any; }> = ({ onClose, t }) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);

    const renderTextWithLinks = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        
        return parts.map((part, index) => {
            if (urlRegex.test(part)) {
                return (
                    <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="guide-link">
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    const usageGuideItems = [
        { titleKey: 'usage_basic_title', descKey: 'usage_basic_desc' },
        { titleKey: 'usage_ai_setup_title', descKey: 'usage_ai_setup_desc' },
        { titleKey: 'usage_ai_use_title', descKey: 'usage_ai_use_desc' },
        { titleKey: 'usage_share_title', descKey: 'usage_share_desc' },
        { titleKey: 'usage_theme_title', descKey: 'usage_theme_desc' },
        { titleKey: 'usage_calendar_title', descKey: 'usage_calendar_desc' },
        { titleKey: 'usage_offline_title', descKey: 'usage_offline_desc' },
    ];

    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="usage-guide-modal">
            <div className="version-info-header">
                <h2>{t('usage_guide_title')}</h2>
            </div>
            
            <div className="version-info-body">
                {usageGuideItems.map((item, index) => (
                    <div className="usage-guide-item" key={index}>
                        <h3>{t(item.titleKey)}</h3>
                        <p>{item.titleKey === 'usage_ai_setup_title' ? renderTextWithLinks(t(item.descKey)) : t(item.descKey)}</p>
                    </div>
                ))}
            </div>
            <div className="modal-buttons">
                <button onClick={handleClose} className="primary">{t('settings_done_button')}</button>
            </div>
        </Modal>
    );
};


const CalendarView: React.FC<{ todos: Goal[]; t: (key: string) => any; onGoalClick: (todo: Goal) => void; language: string; }> = ({ todos, t, onGoalClick, language }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day3' | 'week' | 'month'>('week');

    const changeDate = (amount: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + amount);
        else if (viewMode === 'week') newDate.setDate(newDate.getDate() + (amount * 7));
        else newDate.setDate(newDate.getDate() + (amount * 3));
        setCurrentDate(newDate);
    };

    const calendarData = useMemo(() => {
        const days = [];
        let startDate: Date;
        let numDays: number;
        
        if (viewMode === 'month') {
            const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            startDate = getStartOfWeek(firstDay, language === 'ko' ? 1 : 0);
            numDays = 42;
        } else if (viewMode === 'week') {
            startDate = getStartOfWeek(currentDate, language === 'ko' ? 1 : 0);
            numDays = 7;
        } else {
            startDate = new Date(currentDate);
            startDate.setDate(startDate.getDate() - 1);
            numDays = 3;
        }

        for (let i = 0; i < numDays; i++) {
            const day = new Date(startDate);
            day.setDate(day.getDate() + i);
            days.push(day);
        }
        return days;
    }, [currentDate, viewMode, language]);

    const headerTitle = useMemo(() => {
        if (viewMode === 'month') {
            const year = currentDate.getFullYear();
            const month = t('month_names')[currentDate.getMonth()];
            const format = t('calendar_header_month_format');
            if (format && typeof format === 'string' && format !== 'calendar_header_month_format') {
                return format.replace('{year}', String(year)).replace('{month}', month);
            }
            return `${month} ${year}`;
        }
        return `${currentDate.getFullYear()}.${currentDate.getMonth() + 1}`;
    }, [currentDate, viewMode, t]);

    const dayNames = useMemo(() => {
        const days = t('day_names_short');
        if (language === 'ko' && Array.isArray(days)) {
            // "일"을 맨 뒤로 보내서 "월,화,수,목,금,토,일" 순서로 만듭니다.
            const [sunday, ...restOfWeek] = days;
            return [...restOfWeek, sunday];
        }
        return days; // 영어는 "Sun,Mon..." 순서 그대로 사용합니다.
    }, [language, t]);

    return (
        <div className="calendar-view-container">
            <div className="calendar-header">
                <button onClick={() => changeDate(-1)}>{icons.back}</button><h2>{headerTitle}</h2><button onClick={() => changeDate(1)}>{icons.forward}</button>
            </div>
            <div className="calendar-view-mode-selector">
                <button onClick={() => setViewMode('day3')} className={viewMode === 'day3' ? 'active' : ''}>{t('calendar_view_day3')}</button>
                <button onClick={() => setViewMode('week')} className={viewMode === 'week' ? 'active' : ''}>{t('calendar_view_week')}</button>
                <button onClick={() => setViewMode('month')} className={`calendar-view-button-month ${viewMode === 'month' ? 'active' : ''}`}>{t('calendar_view_month')}</button>
            </div>
            {(viewMode === 'week' || viewMode === 'month') && <div className="calendar-days-of-week">{Array.isArray(dayNames) && dayNames.map(day => <div key={day}>{day}</div>)}</div>}
            <div className={`calendar-grid view-mode-${viewMode}`}>
                {calendarData.map((day) => {
                    const today = new Date();
                    const isToday = isSameDay(day, today);
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const goalsForDay = todos.filter(todo => {
                        // 마감일이 해당 날짜인 과제만 표시
                        return todo.deadline && isSameDay(day, todo.deadline);
                    });
                    return (
                        <div key={day.toISOString()} className={`calendar-day ${!isCurrentMonth && viewMode === 'month' ? 'not-current-month' : ''} ${isToday ? 'is-today' : ''}`} data-day-name={t('day_names_long')[day.getDay()]}>
                            <div className="day-header"><span className="day-number">{day.getDate()}</span></div>
                            <div className="calendar-goals">{goalsForDay.map(goal => <div key={goal.id} className={`calendar-goal-item ${goal.completed ? 'completed' : ''}`} onClick={() => onGoalClick(goal)}>{goal.title}</div>)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AlertModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel?: () => void; confirmText?: string; cancelText?: string; isDestructive?: boolean; t: (key: string) => any; }> = ({ title, message, onConfirm, onCancel, confirmText, cancelText, isDestructive, t }) => {
    const hasCancel = typeof onCancel === 'function';
    return (
        <div className="modal-backdrop alert-backdrop">
            <div className="modal-content alert-modal">
                <div className="alert-content"><h2>{title}</h2><p dangerouslySetInnerHTML={{ __html: message }} /></div>
                <div className="modal-buttons">
                    {hasCancel && <button onClick={onCancel} className="secondary">{cancelText || t('cancel_button')}</button>}
                    <button onClick={onConfirm} className={isDestructive ? 'destructive' : 'primary'}>{confirmText || t('confirm_button')}</button>
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// 헤더 아이콘 버튼 hover 효과 추가
const style = document.createElement('style');
style.textContent = `
  .header-icon-button:hover {
    transform: scale(1.07);
    background-color: rgba(99, 102, 241, 0.1);
    border-radius: 8px;
  }
  
  .header-inline-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .todo-deadline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  
  :root {
    --success-bg: rgba(16, 185, 129, 0.1);
    --success-color: #10b981;
  }
  
  [data-theme="dark"] {
    --success-bg: rgba(16, 185, 129, 0.15);
    --success-color: #34d399;
  }
`;
document.head.appendChild(style);

root.render(<React.StrictMode><App /></React.StrictMode>);