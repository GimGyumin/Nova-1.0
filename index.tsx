import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- 타입 정의 ---
interface Goal {
  id: number;
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string;
  isRecurring: boolean;
  recurringDays: number[];
  deadline: string;
  completed: boolean;
  lastCompletedDate: string | null;
  streak: number;
}

// --- 번역 객체 ---
const translations = {
  ko: {
    // Auth
    language_selection_title: '언어',
    error_wish_required: '목표를 입력해주세요.',
    error_outcome_required: '결과를 입력해주세요.',
    error_obstacle_required: '장애물을 입력해주세요.',
    error_plan_required: "If-Then 계획을 입력해주세요.",
    error_deadline_required: '마감일을 선택해주세요.',
    error_day_required: '하나 이상의 요일을 선택해주세요.',

    // Main Page
    my_goals_title: '목표',
    sort_label_manual: '수동',
    sort_label_deadline: '마감일순',
    sort_label_newest: '최신순',
    sort_label_alphabetical: '이름순',
    sort_label_ai: 'AI 추천',
    ai_sorting_button: '정렬 중...',
    add_new_goal_button_label: '새로운 목표',
    filter_all: '전체',
    filter_active: '진행 중',
    filter_completed: '완료',
    empty_message_all: '새로운 목표를 추가해 시작해 보세요.',
    empty_message_active: '진행 중인 목표가 없습니다.',
    empty_message_completed: '완료된 목표가 없습니다.',
    empty_encouragement_1: '새로운 시작을 응원합니다! 첫 목표를 세워보세요.',
    empty_encouragement_2: '위대한 성공은 작은 발걸음에서 시작됩니다.',
    empty_encouragement_3: '오늘의 작은 실천이 내일의 당신을 만듭니다.',
    empty_encouragement_4: '목표를 향한 여정, 지금 바로 시작하세요!',
    delete_button: '삭제',
    edit_button_aria: '목표 편집',
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
    delete_selected_confirm_title: '목표 삭제',
    delete_selected_confirm_message: '선택한 {count}개의 목표가 영구적으로 삭제됩니다.',
    days_left: '{count}일 남음',
    d_day: 'D-DAY',
    days_overdue: '{count}일 지남',

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
    sort_alert_title: '정렬 실패',
    sort_alert_message: 'AI 추천 정렬을 사용하려면<br/>2개 이상의 목표가 필요합니다.',
    ai_sort_error_title: 'AI 정렬 오류',
    ai_sort_error_message: '지금은 목표를 정렬할 수 없습니다.',
    confirm_button: '확인',
    new_goal_modal_title: '새로운 목표',
    edit_goal_modal_title: '목표 편집',
    wish_label: '목표',
    outcome_label: '최상의 결과',
    obstacle_label: '장애물',
    plan_label: "If-Then 계획",
    deadline_label: '마감일',
    cancel_button: '취소',
    add_button: '추가',
    save_button: '저장',
    goal_details_modal_title: '목표 상세 정보',
    ai_coach_suggestion: '🤖 AI 코치',
    ai_analyzing: 'AI 분석 중...',
    close_button: '닫기',
    ai_sort_reason_modal_title: 'AI 정렬 이유',
    ai_sort_criteria: '🤖 AI 정렬 기준',
    delete_account_final_confirm_title: '모든 데이터 삭제',
    delete_account_final_confirm_message: '모든 목표와 데이터가 영구적으로 삭제되며, 이 작업은 되돌릴 수 없습니다.',
    delete_all_data_button: '모든 데이터 삭제',
    settings_done_button: '완료',
    settings_section_data: '데이터',
    settings_export_data: '데이터 내보내기',
    settings_import_data: '데이터 가져오기',
    import_confirm_title: '데이터 가져오기',
    import_confirm_message: '현재 목표 목록을 덮어씁니다. 이 작업은 되돌릴 수 없습니다.',
    import_success_toast: '데이터를 성공적으로 가져왔습니다.',
    import_error_alert_title: '가져오기 실패',
    import_error_alert_message: '파일을 읽는 중 오류가 발생했거나 파일 형식이 올바르지 않습니다.',
    settings_section_general: '일반',
    settings_section_info: '정보',
    settings_dark_mode: '다크 모드',
    settings_language: '언어',
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
    copyright_notice: '© 2024 GimGyuMin. All Rights Reserved.',
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
    
    // Goal Assistant
    goal_assistant_title: '목표 추가',
    goal_assistant_mode_woop: 'WOOP',
    goal_assistant_mode_automation: '자동 생성',
    automation_title: '목표 자동 생성',
    automation_base_name_label: '기본 목표 이름',
    automation_base_name_placeholder: '예: 단어장 외우기',
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
    version_update_1_title: '세련된 디자인',
    version_update_1_desc: '더욱 세련되고 직관적인 UI로 향상된 사용자 경험을 제공합니다.',
    version_update_2_title: '강력한 목표 관리',
    version_update_2_desc: '여러 목표를 한 번에 선택 및 삭제하고, 반복 목표의 연속 달성과 마감일을 쉽게 확인할 수 있습니다.',
    version_update_3_title: '캘린더와 편의 기능',
    version_update_3_desc: '캘린더, 다크 모드, 다양한 배경 테마 등 새로운 기능으로 목표 관리를 맞춤 설정해 보세요.',
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
    my_goals_title: 'Goals',
    sort_label_manual: 'Manual',
    sort_label_deadline: 'Deadline',
    sort_label_newest: 'Newest',
    sort_label_alphabetical: 'Alphabetical',
    sort_label_ai: 'AI Recommended',
    ai_sorting_button: 'Sorting...',
    add_new_goal_button_label: 'New Goal',
    filter_all: 'All',
    filter_active: 'Active',
    filter_completed: 'Completed',
    empty_message_all: 'Add a new goal to get started.',
    empty_message_active: 'No active goals.',
    empty_message_completed: 'No completed goals yet.',
    empty_encouragement_1: "Let's cheer for your new beginning! Set your first goal.",
    empty_encouragement_2: "Great success starts with a single step.",
    empty_encouragement_3: "Today's small actions shape tomorrow's you.",
    empty_encouragement_4: "Your journey to your goals starts right now!",
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
    sort_alert_title: 'Sort Failed',
    sort_alert_message: 'You need at least two goals to use AI Recommended sort.',
    ai_sort_error_title: 'AI Sort Error',
    ai_sort_error_message: 'Could not sort goals at this time.',
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
    settings_section_data: 'Data',
    settings_export_data: 'Export Data',
    settings_import_data: 'Import Data',
    import_confirm_title: 'Import Data',
    import_confirm_message: 'This will overwrite your current goals. This action cannot be undone.',
    import_success_toast: 'Data imported successfully.',
    import_error_alert_title: 'Import Failed',
    import_error_alert_message: 'There was an error reading the file, or the file format is incorrect.',
    settings_section_general: 'General',
    settings_section_info: 'Information',
    settings_dark_mode: 'Dark Mode',
    settings_language: 'Language',
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
    copyright_notice: '© 2024 GimGyuMin. All Rights Reserved.',
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
    version_update_1_title: 'Refined Design',
    version_update_1_desc: 'A more refined and intuitive interface for an enhanced user experience.',
    version_update_2_title: 'Powerful Goal Management',
    version_update_2_desc: 'Select and delete multiple goals, track streaks for recurring goals, and easily see days left until deadlines.',
    version_update_3_title: 'Calendar & Convenience',
    version_update_3_desc: 'Customize your experience with a calendar, dark mode, and various background themes.',
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
    moon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
    exclamation: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm1-4h-2V7h2v6z"/></svg>,
    globe: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 1.53 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>,
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
    const [language, setLanguage] = useState<string>(() => localStorage.getItem('nova-lang') || 'ko');
    const [todos, setTodos] = useState<Goal[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [sortType, setSortType] = useState<string>('manual');
    const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
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

    const t = useCallback((key: string): any => {
        return translations[language][key] || key;
    }, [language]);

    const encouragementMessages = useMemo(() => [
        t('empty_encouragement_1'),
        t('empty_encouragement_2'),
        t('empty_encouragement_3'),
        t('empty_encouragement_4'),
    ], [t]);

    const randomEncouragement = useMemo(() => encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)], [encouragementMessages]);

    useEffect(() => {
        const savedTodos = localStorage.getItem('nova-todos');
        const savedDarkMode = localStorage.getItem('nova-dark-mode');
        const savedBackground = localStorage.getItem('nova-background');
        const savedSortType = localStorage.getItem('nova-sort-type');

        if (savedTodos) {
            const parsedTodos: Goal[] = JSON.parse(savedTodos);
            const today = new Date().toISOString();
            const updatedTodos = parsedTodos.map(todo => {
                if (todo.isRecurring && todo.lastCompletedDate && !isSameDay(today, todo.lastCompletedDate)) {
                    return { ...todo, completed: false };
                }
                return todo;
            });
            setTodos(updatedTodos);
        }
        if (savedDarkMode) setIsDarkMode(JSON.parse(savedDarkMode));
        if (savedBackground) setBackgroundTheme(savedBackground);
        if (savedSortType) setSortType(savedSortType);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const dataFromUrl = urlParams.get('data');
        if (dataFromUrl) {
            try {
                const decodedJson = atob(dataFromUrl);
                const importedTodos = JSON.parse(decodedJson);
                if (Array.isArray(importedTodos) && (importedTodos.length === 0 || ('wish' in importedTodos[0] && 'id' in importedTodos[0]))) {
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


    useEffect(() => { localStorage.setItem('nova-lang', language); }, [language]);
    useEffect(() => { localStorage.setItem('nova-todos', JSON.stringify(todos)); }, [todos]);
    useEffect(() => { localStorage.setItem('nova-dark-mode', JSON.stringify(isDarkMode)); }, [isDarkMode]);

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

    const filteredTodos = useMemo(() => {
        let sortedTodos = [...todos];
        if (sortType === 'deadline') {
            sortedTodos.sort((a, b) => {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            });
        } else if (sortType === 'newest') {
            sortedTodos.sort((a, b) => b.id - a.id);
        } else if (sortType === 'alphabetical') {
            sortedTodos.sort((a, b) => a.wish.localeCompare(b.wish));
        }

        if (filter === 'active') return sortedTodos.filter(todo => !todo.completed);
        if (filter === 'completed') return sortedTodos.filter(todo => todo.completed);
        return sortedTodos;
    }, [todos, filter, sortType]);
    
    const handleAddTodo = (newTodoData: Omit<Goal, 'id' | 'completed' | 'lastCompletedDate' | 'streak'>) => {
        const newTodo: Goal = { ...newTodoData, id: Date.now(), completed: false, lastCompletedDate: null, streak: 0 };
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
    };

    const handleToggleComplete = (id: number) => {
        const today = new Date().toISOString();
        setTodos(todos.map(todo => {
            if (todo.id === id) {
                const isCompleted = !todo.completed;
                let newStreak = todo.streak;
                if (todo.isRecurring) {
                    if (isCompleted) {
                        if (!todo.lastCompletedDate || !isSameDay(today, todo.lastCompletedDate)) {
                            newStreak = (todo.streak || 0) + 1;
                        }
                    } else {
                        if (todo.lastCompletedDate && isSameDay(today, todo.lastCompletedDate)) {
                            newStreak = Math.max(0, (todo.streak || 1) - 1);
                        }
                    }
                }
                return { ...todo, completed: isCompleted, lastCompletedDate: isCompleted ? today : todo.lastCompletedDate, streak: newStreak };
            }
            return todo;
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
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const prompt = `Here is a list of goals with their details (wish, outcome, obstacle, plan, deadline). Prioritize them based on urgency (closer deadline), importance (based on outcome), and feasibility (based on plan). Return a JSON object with a single key "sorted_ids" which is an array of the goal IDs in the recommended order. Do not include any other text or explanations. Goals: ${JSON.stringify(todos.map(({ id, wish, outcome, obstacle, plan, deadline }) => ({ id, wish, outcome, obstacle, plan, deadline })))}`;
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { sorted_ids: { type: Type.ARRAY, items: { type: Type.NUMBER } } } } }
                });
                
                const resultJson = JSON.parse(response.text);
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
                if (Array.isArray(importedTodos) && importedTodos.every(item => 'wish' in item && 'id' in item)) {
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

    const isAnyModalOpen = isGoalAssistantOpen || !!editingTodo || !!infoTodo || isSettingsOpen || !!alertConfig || isVersionInfoOpen;

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
                    />
                    {isViewModeCalendar ? (
                        <CalendarView todos={todos} t={t} onGoalClick={setInfoTodo} language={language} />
                    ) : (
                        <TodoList todos={filteredTodos} onToggleComplete={handleToggleComplete} onDelete={handleDeleteTodo} onEdit={setEditingTodo} onInfo={setInfoTodo} t={t} filter={filter} randomEncouragement={randomEncouragement} isSelectionMode={isSelectionMode} selectedTodoIds={selectedTodoIds} onSelectTodo={handleSelectTodo} />
                    )}
                </div>
            </div>

            {isGoalAssistantOpen && <GoalAssistantModal onClose={() => setIsGoalAssistantOpen(false)} onAddTodo={handleAddTodo} onAddMultipleTodos={handleAddMultipleTodos} t={t} language={language} />}
            {editingTodo && <GoalAssistantModal onClose={() => setEditingTodo(null)} onEditTodo={handleEditTodo} existingTodo={editingTodo} t={t} language={language} />}
            {infoTodo && <GoalInfoModal todo={infoTodo} onClose={() => setInfoTodo(null)} t={t} />}
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} backgroundTheme={backgroundTheme} onSetBackgroundTheme={setBackgroundTheme} onExportData={handleExportData} onImportData={handleImportData} setAlertConfig={setAlertConfig} onDeleteAllData={handleDeleteAllData} dataActionStatus={dataActionStatus} language={language} onSetLanguage={setLanguage} t={t} todos={todos} setToastMessage={setToastMessage} onOpenVersionInfo={() => setIsVersionInfoOpen(true)} />}
            {isVersionInfoOpen && <VersionInfoModal onClose={() => setIsVersionInfoOpen(false)} t={t} />}
            {alertConfig && <AlertModal title={alertConfig.title} message={alertConfig.message} onConfirm={() => { alertConfig.onConfirm?.(); setAlertConfig(null); }} onCancel={alertConfig.onCancel ? () => { alertConfig.onCancel?.(); setAlertConfig(null); } : undefined} confirmText={alertConfig.confirmText} cancelText={alertConfig.cancelText} isDestructive={alertConfig.isDestructive} t={t} />}
            {toastMessage && <div className="toast-notification">{toastMessage}</div>}
        </div>
    );
};

const Header: React.FC<{ t: (key: string) => any; isSelectionMode: boolean; selectedCount: number; onCancelSelection: () => void; onDeleteSelected: () => void; isViewModeCalendar: boolean; onToggleViewMode: () => void; isAiSorting: boolean; sortType: string; onSort: (type: string) => void; filter: string; onFilter: (type: string) => void; onSetSelectionMode: () => void; onOpenSettings: () => void; onAddGoal: () => void; }> = ({ t, isSelectionMode, selectedCount, onCancelSelection, onDeleteSelected, isViewModeCalendar, onToggleViewMode, isAiSorting, sortType, onSort, filter, onFilter, onSetSelectionMode, onOpenSettings, onAddGoal }) => {
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
                <h1>{t('my_goals_title')}</h1>
                {!isSelectionMode && (
                    <div className="header-inline-actions">
                        <button onClick={onToggleViewMode} className="header-icon-button" aria-label={isViewModeCalendar ? t('list_view_button_aria') : t('calendar_view_button_aria')}>{isViewModeCalendar ? icons.list : icons.calendar}</button>
                        <div className="filter-sort-container">
                            <button onClick={toggleFilterPopover} onTouchStart={toggleFilterPopover} className="header-icon-button" aria-label={t('filter_sort_button_aria')}>{isAiSorting ? <div className="spinner" /> : icons.filter}</button>
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
                                        <button onClick={() => { onSort('manual'); }} className={`popover-action-button ${sortType === 'manual' ? 'active' : ''}`}><span>{t('sort_label_manual')}</span>{sortType === 'manual' && icons.check}</button>
                                        <button onClick={() => { onSort('deadline'); }} className={`popover-action-button ${sortType === 'deadline' ? 'active' : ''}`}><span>{t('sort_label_deadline')}</span>{sortType === 'deadline' && icons.check}</button>
                                        <button onClick={() => { onSort('newest'); }} className={`popover-action-button ${sortType === 'newest' ? 'active' : ''}`}><span>{t('sort_label_newest')}</span>{sortType === 'newest' && icons.check}</button>
                                        <button onClick={() => { onSort('alphabetical'); }} className={`popover-action-button ${sortType === 'alphabetical' ? 'active' : ''}`}><span>{t('sort_label_alphabetical')}</span>{sortType === 'alphabetical' && icons.check}</button>
                                        <button onClick={() => { onSort('ai'); }} className="popover-action-button with-icon"><span className="popover-button-icon">{icons.ai}</span><span>{isAiSorting ? t('ai_sorting_button') : t('sort_label_ai')}</span></button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={onOpenSettings} className="header-icon-button" aria-label={t('settings_title')}>{icons.settings}</button>
                    </div>
                )}
            </div>
            <div className="header-right">
                {isSelectionMode ? (
                    <button onClick={onDeleteSelected} className="header-action-button destructive">{t('delete_selected_button_label').replace('{count}', String(selectedCount))}</button>
                ) : (
                    <button onClick={onAddGoal} className="header-icon-button" aria-label={t('add_new_goal_button_label')}>{icons.add}</button>
                )}
            </div>
        </header>
    );
};

const TodoList: React.FC<{ todos: Goal[]; onToggleComplete: (id: number) => void; onDelete: (id: number) => void; onEdit: (todo: Goal) => void; onInfo: (todo: Goal) => void; t: (key: string) => any; filter: string; randomEncouragement: string; isSelectionMode: boolean; selectedTodoIds: Set<number>; onSelectTodo: (id: number) => void; }> = ({ todos, onToggleComplete, onDelete, onEdit, onInfo, t, filter, randomEncouragement, isSelectionMode, selectedTodoIds, onSelectTodo }) => {
    if (todos.length === 0) {
        const messageKey = `empty_message_${filter}`;
        return <div className="empty-message"><p>{t(messageKey)}</p>{filter === 'all' && <span>{randomEncouragement}</span>}</div>;
    }
    return <ul>{todos.map(todo => <TodoItem key={todo.id} todo={todo} onToggleComplete={onToggleComplete} onDelete={onDelete} onEdit={onEdit} onInfo={onInfo} t={t} isSelectionMode={isSelectionMode} isSelected={selectedTodoIds.has(todo.id)} onSelect={onSelectTodo} />)}</ul>;
};

const TodoItem: React.FC<{ todo: Goal; onToggleComplete: (id: number) => void; onDelete: (id: number) => void; onEdit: (todo: Goal) => void; onInfo: (todo: Goal) => void; t: (key: string) => any; isSelectionMode: boolean; isSelected: boolean; onSelect: (id: number) => void; }> = React.memo(({ todo, onToggleComplete, onDelete, onEdit, onInfo, t, isSelectionMode, isSelected, onSelect }) => {
    const handleItemClick = () => { if (isSelectionMode) onSelect(todo.id); };
    return (
        <li className={`${todo.completed ? 'completed' : ''} ${isSelectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`} onClick={handleItemClick}>
            <div className="swipeable-content">
                <label className="checkbox-container" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={todo.completed} onChange={() => onToggleComplete(todo.id)} /><span className="checkmark"></span></label>
                <div className="todo-text-with-streak"><span className="todo-text">{todo.wish}</span>{todo.isRecurring && todo.streak > 0 && <div className="streak-indicator">{icons.flame}<span>{todo.streak}</span></div>}</div>
                <div className="todo-actions-and-meta">
                    <div className="todo-meta-badges">{todo.deadline && <span className="todo-deadline">{getRelativeTime(todo.deadline, t)}</span>}</div>
                    <div className="todo-buttons">
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

const GoalAssistantStepContent: React.FC<{ step: number; t: (key: string) => any; [key: string]: any }> = ({ step, t, ...props }) => {
    const { wish, setWish, outcome, setOutcome, obstacle, setObstacle, plan, setPlan, isRecurring, setIsRecurring, recurringDays, setRecurringDays, deadline, setDeadline, noDeadline, setNoDeadline, errors, language } = props;
    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState('');
    const [aiError, setAiError] = useState('');

    const getAIFeedback = async (fieldName: string, value: string) => {
        if (!value) return;
        setIsAiLoading(true);
        setAiFeedback('');
        setAiError('');
        try {
            const prompt = `Provide concise, actionable feedback on this part of a WOOP goal: ${fieldName} - "${value}". The feedback should be helpful and encouraging, in ${language === 'ko' ? 'Korean' : 'English'}. Keep it to 1-2 sentences.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setAiFeedback(response.text);
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


const GoalAssistantModal: React.FC<{ onClose: () => void; onAddTodo?: (newTodoData: Omit<Goal, 'id' | 'completed' | 'lastCompletedDate' | 'streak'>) => void; onAddMultipleTodos?: (newTodosData: Omit<Goal, 'id' | 'completed' | 'lastCompletedDate' | 'streak'>[]) => void; onEditTodo?: (updatedTodo: Goal) => void; existingTodo?: Goal; t: (key: string) => any; language: string; }> = ({ onClose, onAddTodo, onAddMultipleTodos, onEditTodo, existingTodo, t, language }) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);
    const [mode, setMode] = useState<'woop' | 'automation'>('woop');
    const [step, setStep] = useState(1);
    const [animationDir, setAnimationDir] = useState<'forward' | 'backward'>('forward');
    const [wish, setWish] = useState(existingTodo?.wish || '');
    const [outcome, setOutcome] = useState(existingTodo?.outcome || '');
    const [obstacle, setObstacle] = useState(existingTodo?.obstacle || '');
    const [plan, setPlan] = useState(existingTodo?.plan || '');
    const [isRecurring, setIsRecurring] = useState(existingTodo?.isRecurring || false);
    const [recurringDays, setRecurringDays] = useState<number[]>(existingTodo?.recurringDays || []);
    const [deadline, setDeadline] = useState(existingTodo?.deadline || '');
    const [noDeadline, setNoDeadline] = useState(!existingTodo?.deadline);
    const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

    const totalSteps = 5;

    const validateStep = (currentStep: number) => {
        const newErrors: { [key: string]: boolean } = {};
        if (currentStep === 1 && !wish.trim()) newErrors.wish = true;
        if (currentStep === 2 && !outcome.trim()) newErrors.outcome = true;
        if (currentStep === 3 && !obstacle.trim()) newErrors.obstacle = true;
        if (currentStep === 4 && !plan.trim()) newErrors.plan = true;
        if (currentStep === 5) {
            if (!noDeadline && !deadline) newErrors.deadline = true;
            if (isRecurring && recurringDays.length === 0) newErrors.recurringDays = true;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleNext = () => {
        if (validateStep(step)) {
            if (step < totalSteps) {
                setAnimationDir('forward');
                setStep(s => s + 1);
            } else {
                handleSubmit();
            }
        }
    };
    const handleBack = () => {
        if (step > 1) {
            setAnimationDir('backward');
            setStep(s => s - 1);
        }
    };
    const handleSubmit = () => {
        if (!validateStep(5)) return;
        const goalData = { wish, outcome, obstacle, plan, isRecurring, recurringDays, deadline: noDeadline ? '' : deadline };
        if (existingTodo && onEditTodo) onEditTodo({ ...existingTodo, ...goalData });
        else if (onAddTodo) onAddTodo(goalData);
    };

    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="goal-assistant-modal">
            <div className="goal-assistant-header">
                <div className="goal-assistant-header-left">{step > 1 && mode === 'woop' && <button onClick={handleBack} className="settings-back-button">{icons.back}</button>}</div>
                <h2>{t('goal_assistant_title')}</h2>
                <div className="goal-assistant-header-right"><button onClick={handleClose} className="close-button">{icons.close}</button></div>
            </div>
            
            {!existingTodo && (
                 <div className="modal-mode-switcher-container">
                    <div className="modal-mode-switcher">
                        <button onClick={() => setMode('woop')} className={mode === 'woop' ? 'active' : ''}>{t('goal_assistant_mode_woop')}</button>
                        <button onClick={() => setMode('automation')} className={mode === 'automation' ? 'active' : ''}>{t('goal_assistant_mode_automation')}</button>
                    </div>
                </div>
            )}

            <div className="goal-assistant-body">
                {mode === 'woop' ? (
                    <>
                        <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${(step / totalSteps) * 100}%` }}></div></div>
                        <div className={`goal-assistant-step-content-animator ${animationDir}`} key={step}>
                            <GoalAssistantStepContent step={step} t={t} {...{ wish, setWish, outcome, setOutcome, obstacle, setObstacle, plan, setPlan, isRecurring, setIsRecurring, recurringDays, setRecurringDays, deadline, setDeadline, noDeadline, setNoDeadline, errors, language }} />
                        </div>
                         <div className="goal-assistant-nav">
                            {step > 1 ? (
                                <button onClick={handleBack} className="secondary">{t('back_button')}</button>
                            ) : (
                                <div /> /* Placeholder for alignment */
                            )}
                            <button onClick={handleNext} className="primary">{step === totalSteps ? (existingTodo ? t('save_button') : t('add_button')) : t('next_button')}</button>
                        </div>
                    </>
                ) : (
                    onAddMultipleTodos && <AutomationForm onGenerate={onAddMultipleTodos} t={t} />
                )}
            </div>
        </Modal>
    );
};

const GoalInfoModal: React.FC<{ todo: Goal; onClose: () => void; t: (key: string) => any; }> = ({ todo, onClose, t }) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);
    const [aiFeedback, setAiFeedback] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState(false);

    const getAIFeedback = async () => {
        setIsAiLoading(true);
        setAiFeedback('');
        setAiError(false);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Based on the WOOP method, provide a concise and encouraging suggestion for the following goal: Wish: "${todo.wish}", Best Outcome: "${todo.outcome}", Obstacle: "${todo.obstacle}", Plan: "${todo.plan}". Focus on strengthening the plan or reframing the obstacle.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setAiFeedback(response.text);
        } catch (error) {
            console.error(error);
            setAiError(true);
        } finally {
            setIsAiLoading(false);
        }
    };
    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="info-modal">
            <div className="info-modal-content">
                <h2>{t('goal_details_modal_title')}</h2>
                <div className="info-section"><h4>{t('wish_label')}</h4><p>{todo.wish}</p></div>
                <div className="info-section"><h4>{t('outcome_label')}</h4><p>{todo.outcome}</p></div>
                <div className="info-section"><h4>{t('obstacle_label')}</h4><p>{todo.obstacle}</p></div>
                <div className="info-section"><h4>{t('plan_label')}</h4><p>{todo.plan}</p></div>
                <div className="ai-analysis-section">
                    <h4>{t('ai_coach_suggestion')}</h4>
                    {isAiLoading ? <p>{t('ai_analyzing')}</p> : aiFeedback ? <p>{aiFeedback}</p> : aiError ? <p className="ai-error">{t('ai_sort_error_message')}</p> : <button onClick={getAIFeedback} className="feedback-button">{t('ai_coach_suggestion')}</button>}
                </div>
            </div>
            <div className="modal-buttons"><button onClick={handleClose} className="primary">{t('close_button')}</button></div>
        </Modal>
    );
};

const SettingsModal: React.FC<{
    onClose: () => void;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
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
}> = ({
    onClose, isDarkMode, onToggleDarkMode, backgroundTheme, onSetBackgroundTheme,
    onExportData, onImportData, setAlertConfig, onDeleteAllData, dataActionStatus,
    language, onSetLanguage, t, todos, setToastMessage, onOpenVersionInfo
}) => {
    const [isClosing, handleClose] = useModalAnimation(onClose);
    const [activeTab, setActiveTab] = useState('appearance');
    const [shareableLink, setShareableLink] = useState('');
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

    const handleCreateShareLink = () => {
        try {
            const dataStr = JSON.stringify(todos);
            const encodedData = btoa(dataStr);
            const url = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(encodedData)}`;
            setShareableLink(url);
        } catch (e) {
            console.error("Failed to create share link", e);
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
                        <div className="settings-section-header">{t('settings_dark_mode')}</div>
                        <div className="settings-section-body">
                            <label className="settings-item">
                                <span>{t('settings_dark_mode')}</span>
                                <div className="theme-toggle-switch">
                                    <input type="checkbox" checked={isDarkMode} onChange={onToggleDarkMode} />
                                    <span className="slider round"></span>
                                </div>
                            </label>
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
                                    <span>1.1.1</span>
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
                                <button className="settings-item action-item" onClick={handleCreateShareLink}>
                                    <span className="action-text">{t('settings_generate_link')}</span>
                                </button>
                            )}
                            {shareableLink && (
                                <div className="share-link-container">
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
    const buildNumber = "1.1.1 (24A0515)";

    const changelogItems = [
        { icon: icons.settings, titleKey: 'version_update_1_title', descKey: 'version_update_1_desc' },
        { icon: icons.list, titleKey: 'version_update_2_title', descKey: 'version_update_2_desc' },
        { icon: icons.calendar, titleKey: 'version_update_3_title', descKey: 'version_update_3_desc' },
    ];

    return (
        <Modal onClose={handleClose} isClosing={isClosing} className="version-info-modal">
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
                        if (todo.isRecurring) {
                            const dayOfWeek = (day.getDay() + 6) % 7; // 0=Mon, 6=Sun
                            return todo.recurringDays.includes(dayOfWeek);
                        }
                        return todo.deadline && isSameDay(day, todo.deadline);
                    });
                    return (
                        <div key={day.toISOString()} className={`calendar-day ${!isCurrentMonth && viewMode === 'month' ? 'not-current-month' : ''} ${isToday ? 'is-today' : ''}`} data-day-name={t('day_names_long')[day.getDay()]}>
                            <div className="day-header"><span className="day-number">{day.getDate()}</span></div>
                            <div className="calendar-goals">{goalsForDay.map(goal => <div key={goal.id} className={`calendar-goal-item ${goal.completed && (goal.lastCompletedDate && isSameDay(day, goal.lastCompletedDate)) ? 'completed' : ''}`} onClick={() => onGoalClick(goal)}>{goal.wish}</div>)}</div>
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
root.render(<React.StrictMode><App /></React.StrictMode>);