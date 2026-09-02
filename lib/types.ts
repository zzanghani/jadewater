export type Role = 'owner' | 'staff'

export type ProfileStatus = 'pending' | 'approved' | 'rejected'

export type Department = 'design' | 'marketing' | 'ops' | 'rnd'

export const DEPARTMENT_LABELS: Record<Department, string> = {
  design: '디자인',
  marketing: '마케팅',
  ops: '운영',
  rnd: 'RnD',
}

export type Profile = {
  id: string
  email: string
  name: string
  role: Role
  status: ProfileStatus
  store_id: string | null
  department: Department | null
  avatar_path: string | null
  created_at: string
}

// 브랜드 — 베스트메이트컴퍼니 아래의 사업 브랜드(제이드앤워터 / 정다미).
// 헤더 로고와 화면 톤, 리뷰 수집 검색어가 브랜드 단위로 갈린다.
export type Brand = {
  id: string
  name: string
  sort_order: number
  // 비어 있으면 헤더에 로고 대신 브랜드명을 글자로 보여준다.
  logo_path: string | null
  theme_class: string
  review_keyword: string | null
  blog_match_token: string | null
  created_at: string
}

export type Store = {
  id: string
  name: string
  sort_order: number
  brand_id: string
  // 매장 라벨 색과 사람 이름 옆에 붙는 짧은 태그. 예전에는 매장 이름 글자를
  // 매칭해서 뽑았는데, 브랜드가 늘면 "정다미 서울역점"이 "제이드앤워터
  // 서울역점"으로 오인식돼서 컬럼 값으로 옮겼다.
  color: string
  short_label: string | null
  // 런치/디너 객수를 나눠 받을지. 하남처럼 브레이크타임이 없는 매장은 false.
  uses_service_split: boolean
  // 네이버 블로그 글이 이 매장 얘기인지 판별할 지역 키워드.
  blog_keywords: string[]
  google_place_id: string | null
  naver_place_id: string | null
  kakao_place_id: string | null
  created_at: string
}

export type DailyClosing = {
  id: string
  date: string
  store_id: string

  lunch_guests: number
  dinner_guests: number
  total_guests: number
  lunch_teams: number
  dinner_teams: number
  total_teams: number
  visit_teams: number

  card_sales: number
  cash_sales: number
  easypay_sales: number
  discount_amount: number
  payment_sales_total: number

  food_sales: number
  beverage_sales: number
  wine_sales: number
  rental_sales: number
  category_sales_total: number

  coupang_eats_sales: number
  baemin_sales: number
  delivery_sales_total: number

  grand_total: number

  notes: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

type DailyClosingGenerated =
  | 'total_guests'
  | 'total_teams'
  | 'payment_sales_total'
  | 'category_sales_total'
  | 'delivery_sales_total'
  | 'grand_total'

export type PaymentRequest = {
  id: string
  store_id: string | null
  department: Department | null
  vendor_name: string
  amount: number
  bank_name: string | null
  account_number: string | null
  completed_at: string | null
  created_by: string
  created_at: string
}

export type ReceiptCategory = '식재료' | '음료재료' | '소모품' | '기타'

export type Receipt = {
  id: string
  date: string
  store_id: string
  supplier: string
  items: string | null
  amount: number
  category: ReceiptCategory
  created_by: string
  created_at: string
}

export type HiddenSupplier = {
  id: string
  store_id: string
  supplier: string
  hidden_by: string
  hidden_at: string
}

export type LineItem = {
  name: string
  amount: number
  note?: string
}

export type LaborItem = LineItem & {
  type: '정직원' | '파트타이머'
  deduction?: number
}

export type UtilityCategory =
  | '임대료(수수료)'
  | '전기요금'
  | '가스요금'
  | '수도요금'
  | '관리비'
  | '기타'

export type UtilityItem = LineItem & {
  type: UtilityCategory
}

export type MonthlySettlement = {
  id: string
  store_id: string
  month: string
  manager_name: string | null

  labor_items: LaborItem[]
  utility_items: UtilityItem[]
  hq_fee_items: LineItem[]

  pension_reserve: number
  vat_reserve: number
  corp_tax_reserve: number
  hq_operating_reserve: number
  reserve_carryover: number
  reserve_deduction: number
  discount_amount: number

  notes: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ReviewPlatform = '네이버' | '카카오맵' | '구글'

export type ReviewPlatformStat = {
  id: string
  store_id: string
  date: string
  platform: ReviewPlatform
  rating: number
  review_count: number
  change_count: number
  created_at: string
}

export type Review = {
  id: string
  store_id: string
  date: string
  platform: ReviewPlatform
  rating: number
  body: string
  source_review_id: string | null
  created_at: string
}

export type ReviewAiSummary = {
  id: string
  store_id: string
  date: string
  summary: string
  created_at: string
}

export type BlogPost = {
  id: string
  store_id: string
  date: string
  posted_at: string | null
  title: string
  body: string | null
  blogger_name: string | null
  url: string
  created_at: string
}

export type PushSubscriptionRow = {
  id: string
  user_id: string
  store_id: string | null
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export type FieldExpenseCategory =
  | '식자재'
  | '소모품'
  | '유류비'
  | '복리후생'
  | '운영'
  | '마케팅'
  | '기타'

export type FieldExpensePaymentMethod = '법인카드' | '현금'

export type FieldExpense = {
  id: string
  store_id: string
  date: string
  category: FieldExpenseCategory
  description: string
  amount: number
  payment_method: FieldExpensePaymentMethod
  receipt_photo_path: string | null
  created_by: string
  created_at: string
}

export type MonthlyPlanType = 'task' | 'vacation'

export type MonthlyPlan = {
  id: string
  title: string
  description: string | null
  plan_type: MonthlyPlanType
  start_date: string
  end_date: string
  start_time: string | null
  color: string
  created_by: string
  created_at: string
}

export type MonthlyPlanFollower = {
  id: string
  plan_id: string
  user_id: string
  confirmed: boolean
  created_at: string
}

export type MonthlyPlanComment = {
  id: string
  plan_id: string
  body: string
  created_by: string
  created_at: string
}

export type MonthlyPlanAttachment = {
  id: string
  comment_id: string
  storage_path: string
  file_name: string
  created_by: string
  created_at: string
}

export type BoardCategory = '공지사항' | '마케팅' | '운영HR' | '디자인' | 'R&D'

export type BoardPost = {
  id: string
  category: BoardCategory
  title: string
  body: string
  created_by: string
  requester_confirmed: boolean
  completed_at: string | null
  created_at: string
}

export type BoardPostFollower = {
  id: string
  post_id: string
  user_id: string
  confirmed: boolean
  created_at: string
}

export type BoardComment = {
  id: string
  post_id: string
  body: string
  created_by: string
  created_at: string
}

export type BoardAttachment = {
  id: string
  post_id: string | null
  comment_id: string | null
  storage_path: string
  file_name: string
  created_by: string
  created_at: string
}

export type WeeklySalesRow = {
  label: string
  lastWeek: string
  thisWeek: string
}

export type WeeklyReport = {
  id: string
  store_id: string
  week_start: string
  goals: string[]
  hr_items: string[]
  sales_notes: string[]
  sales_table: WeeklySalesRow[]
  issues: string[]
  kitchen_items: string[]
  hall_items: string[]
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type ScheduleRole = '점장' | '부점장' | '팀장' | '사원' | '파트타이머'

export type EmployeeDepartment = '경영진' | '관리팀' | '마케팅팀' | '슈퍼바이저' | '디자인팀'
export type EmployeeTeam = '홀' | '키친'
export type EmploymentType = '정직원' | 'PT'

export const EMPLOYEE_DEPARTMENTS: EmployeeDepartment[] = [
  '경영진',
  '관리팀',
  '마케팅팀',
  '슈퍼바이저',
  '디자인팀',
]

// store_id가 있으면 매장 소속, department가 있으면 MSO운영회사 소속 —
// 반드시 둘 중 하나만 채워진다(DB 체크 제약과 동일).
export type Employee = {
  id: string
  store_id: string | null
  department: EmployeeDepartment | null
  team: EmployeeTeam | null
  employment_type: EmploymentType
  name: string
  position: ScheduleRole
  phone: string | null
  email: string | null
  address: string | null
  birthday: string | null
  hire_date: string
  health_cert_issued_at: string | null
  resigned_at: string | null
  // 로그인 계정(auth.users) 연결. 지점장이 직원 리스트에서 붙여준다.
  // 연결돼 있어야 부점장·팀장이 기록을 남기고, 본인이 칭찬을 볼 수 있다.
  user_id: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

// 사건 기록 — 점장·부점장·팀장이 그날그날 남기는 짧은 칭찬/지적.
// 분기 말 근무평가에서 문항별 근거 자료로 붙는다.
export type EmployeeRecordKind = '칭찬' | '지적'

export type EmployeeRecord = {
  id: string
  employee_id: string
  store_id: string | null
  kind: EmployeeRecordKind
  body: string
  occurred_on: string
  eval_item: string | null
  eval_item_source: 'ai' | 'manual'
  // 칭찬은 저장 즉시 true, 지적은 면담 때 공개할 때까지 false.
  shared_with_employee: boolean
  created_by: string
  created_at: string
  edited_at: string | null
  edit_count: number
}

// 근무평가 — 1차(점장)/2차(부점장·팀장·SV) 점수를 각각 담고,
// 확정 시점의 총점·등급을 굳혀 둔다.
export type PerformanceReview = {
  id: string
  employee_id: string
  store_id: string | null
  period: string
  rubric_key: string
  first_scores: Record<string, number>
  first_comment: string | null
  first_by: string | null
  first_submitted_at: string | null
  second_scores: Record<string, number>
  second_comment: string | null
  second_by: string | null
  second_submitted_at: string | null
  // 자기평가 — 점수에 반영하지 않고 면담에서 갭을 보여주는 용도.
  self_scores: Record<string, number>
  self_submitted_at: string | null
  next_goals: string | null
  midterm_good: string | null
  midterm_improve: string | null
  midterm_at: string | null
  demotion_reason: string | null
  total_score: number | null
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | null
  finalized_at: string | null
  created_at: string
  updated_at: string
}

// 매장 지문인식 근태를 월말에 옮겨 담는 표. 분기 3개월치를 합산해
// 근무평가의 근태 문항을 자동 채점한다.
export type EmployeeAttendance = {
  id: string
  employee_id: string
  store_id: string | null
  month: string
  late_count: number
  absent_count: number
  unauthorized_count: number
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DamageCategory = '기물' | '비품' | '시설' | '식자재' | '기타'
export type DamageStatus = '확인중' | '처리완료' | '경고' | '변상'

// 자산 분실·파손 기록. 한 달 3건 이상이면 근무평가 등급이 한 단계 내려간다.
export type DamageRecord = {
  id: string
  store_id: string
  employee_id: string | null
  occurred_on: string
  category: DamageCategory
  item_name: string
  quantity: number
  reason: string | null
  status: DamageStatus
  action_note: string | null
  amount: number | null
  created_by: string
  created_at: string
  updated_at: string
}

// 점장 분기 평가 — 직원 평가와 배점 구조가 달라 표를 따로 쓴다.
export type ManagerReview = {
  id: string
  employee_id: string
  store_id: string | null
  period: string
  scores: Record<string, number>
  auto_snapshot: Record<string, unknown>
  comment: string | null
  gate_exempt: boolean
  gate_applied: boolean
  quarter_profit: number | null
  total_score: number | null
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | null
  finalized_at: string | null
  finalized_by: string | null
  created_at: string
  updated_at: string
}

export type ScheduleShift = {
  id: string
  store_id: string
  date: string
  role: ScheduleRole
  employee_name: string
  start_time: string
  end_time: string
  break_minutes: number
  notes: string | null
  batch_id: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

// 근무 빠른입력 프리셋(오픈조/미들조/마감조 등) — 매장마다 직접 정한다.
export type ScheduleShiftPreset = {
  id: string
  store_id: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type InventorySection = '홀' | '주방'

export type InventoryItem = {
  id: string
  store_id: string
  section: InventorySection
  name: string
  unit: string | null
  notes: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type InventoryCount = {
  id: string
  item_id: string
  store_id: string
  date: string
  quantity: number
  // 주방 품목만 채워짐(홀 소모품은 계속 null) — 생산량 예측용.
  produced_quantity: number | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type DirectMessage = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
}

export type ChatRoom = {
  id: string
  name: string
  created_by: string
  store_id: string | null
  created_at: string
}

export type ChatRoomMember = {
  id: string
  room_id: string
  user_id: string
  last_read_at: string | null
  created_at: string
}

export type ChatMessage = {
  id: string
  room_id: string
  sender_id: string
  body: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; email: string; name: string }
        Update: Partial<Profile>
        Relationships: []
      }
      brands: {
        Row: Brand
        Insert: Partial<Brand> & { name: string }
        Update: Partial<Brand>
        Relationships: []
      }
      stores: {
        Row: Store
        Insert: Partial<Store> & { name: string }
        Update: Partial<Store>
        Relationships: []
      }
      daily_closings: {
        Row: DailyClosing
        Insert: Partial<Omit<DailyClosing, DailyClosingGenerated>> & {
          date: string
          store_id: string
          created_by: string
        }
        Update: Partial<Omit<DailyClosing, DailyClosingGenerated>>
        Relationships: []
      }
      payment_requests: {
        Row: PaymentRequest
        Insert: Partial<PaymentRequest> & {
          vendor_name: string
          amount: number
          created_by: string
        }
        Update: Partial<PaymentRequest>
        Relationships: []
      }
      receipts: {
        Row: Receipt
        Insert: Partial<Receipt> & {
          date: string
          store_id: string
          supplier: string
          amount: number
          created_by: string
        }
        Update: Partial<Receipt>
        Relationships: []
      }
      hidden_suppliers: {
        Row: HiddenSupplier
        Insert: Partial<HiddenSupplier> & {
          store_id: string
          supplier: string
          hidden_by: string
        }
        Update: Partial<HiddenSupplier>
        Relationships: []
      }
      monthly_settlements: {
        Row: MonthlySettlement
        Insert: Partial<MonthlySettlement> & {
          store_id: string
          month: string
          created_by: string
        }
        Update: Partial<MonthlySettlement>
        Relationships: []
      }
      review_platform_stats: {
        Row: ReviewPlatformStat
        Insert: Partial<ReviewPlatformStat> & {
          store_id: string
          date: string
          platform: ReviewPlatform
        }
        Update: Partial<ReviewPlatformStat>
        Relationships: []
      }
      reviews: {
        Row: Review
        Insert: Partial<Review> & {
          store_id: string
          date: string
          platform: ReviewPlatform
          rating: number
          body: string
        }
        Update: Partial<Review>
        Relationships: []
      }
      review_ai_summaries: {
        Row: ReviewAiSummary
        Insert: Partial<ReviewAiSummary> & { store_id: string; date: string }
        Update: Partial<ReviewAiSummary>
        Relationships: []
      }
      blog_posts: {
        Row: BlogPost
        Insert: Partial<BlogPost> & { store_id: string; date: string; title: string; url: string }
        Update: Partial<BlogPost>
        Relationships: []
      }
      field_expenses: {
        Row: FieldExpense
        Insert: Partial<FieldExpense> & {
          store_id: string
          date: string
          category: FieldExpenseCategory
          description: string
          amount: number
          payment_method: FieldExpensePaymentMethod
          created_by: string
        }
        Update: Partial<FieldExpense>
        Relationships: []
      }
      weekly_reports: {
        Row: WeeklyReport
        Insert: Partial<WeeklyReport> & { store_id: string; week_start: string; created_by: string }
        Update: Partial<WeeklyReport>
        Relationships: []
      }
      schedule_shifts: {
        Row: ScheduleShift
        Insert: Partial<ScheduleShift> & {
          store_id: string
          date: string
          role: ScheduleRole
          employee_name: string
          start_time: string
          end_time: string
          created_by: string
        }
        Update: Partial<ScheduleShift>
        Relationships: []
      }
      schedule_shift_presets: {
        Row: ScheduleShiftPreset
        Insert: Partial<ScheduleShiftPreset> & {
          store_id: string
          name: string
          start_time: string
          end_time: string
          created_by: string
        }
        Update: Partial<ScheduleShiftPreset>
        Relationships: []
      }
      employees: {
        Row: Employee
        Insert: Partial<Employee> & {
          name: string
          position: ScheduleRole
          hire_date: string
          created_by: string
        }
        Update: Partial<Employee>
        Relationships: []
      }
      employee_records: {
        Row: EmployeeRecord
        Insert: Partial<EmployeeRecord> & {
          employee_id: string
          kind: EmployeeRecordKind
          body: string
          created_by: string
        }
        Update: Partial<EmployeeRecord>
        Relationships: []
      }
      performance_reviews: {
        Row: PerformanceReview
        Insert: Partial<PerformanceReview> & {
          employee_id: string
          period: string
          rubric_key: string
        }
        Update: Partial<PerformanceReview>
        Relationships: []
      }
      employee_attendance: {
        Row: EmployeeAttendance
        Insert: Partial<EmployeeAttendance> & { employee_id: string; month: string }
        Update: Partial<EmployeeAttendance>
        Relationships: []
      }
      damage_records: {
        Row: DamageRecord
        Insert: Partial<DamageRecord> & {
          store_id: string
          item_name: string
          created_by: string
        }
        Update: Partial<DamageRecord>
        Relationships: []
      }
      manager_reviews: {
        Row: ManagerReview
        Insert: Partial<ManagerReview> & { employee_id: string; period: string }
        Update: Partial<ManagerReview>
        Relationships: []
      }
      inventory_items: {
        Row: InventoryItem
        Insert: Partial<InventoryItem> & {
          store_id: string
          section: InventorySection
          name: string
          created_by: string
        }
        Update: Partial<InventoryItem>
        Relationships: []
      }
      inventory_counts: {
        Row: InventoryCount
        Insert: Partial<InventoryCount> & {
          item_id: string
          store_id: string
          date: string
          created_by: string
        }
        Update: Partial<InventoryCount>
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: Partial<PushSubscriptionRow> & {
          user_id: string
          store_id: string | null
          endpoint: string
          p256dh: string
          auth: string
        }
        Update: Partial<PushSubscriptionRow>
        Relationships: []
      }
      board_posts: {
        Row: BoardPost
        Insert: Partial<BoardPost> & {
          category: BoardCategory
          title: string
          body: string
          created_by: string
        }
        Update: Partial<Pick<BoardPost, "requester_confirmed" | "completed_at" | "title" | "body">>
        Relationships: []
      }
      board_post_followers: {
        Row: BoardPostFollower
        Insert: Partial<BoardPostFollower> & { post_id: string; user_id: string }
        Update: Partial<Pick<BoardPostFollower, "confirmed">>
        Relationships: []
      }
      board_comments: {
        Row: BoardComment
        Insert: Partial<BoardComment> & { post_id: string; body: string; created_by: string }
        Update: Partial<BoardComment>
        Relationships: []
      }
      board_attachments: {
        Row: BoardAttachment
        Insert: Partial<BoardAttachment> & {
          post_id?: string | null
          comment_id?: string | null
          storage_path: string
          file_name: string
          created_by: string
        }
        Update: Partial<BoardAttachment>
        Relationships: []
      }
      monthly_plans: {
        Row: MonthlyPlan
        Insert: Partial<MonthlyPlan> & {
          title: string
          start_date: string
          end_date: string
          created_by: string
        }
        Update: Partial<MonthlyPlan>
        Relationships: []
      }
      monthly_plan_followers: {
        Row: MonthlyPlanFollower
        Insert: Partial<MonthlyPlanFollower> & { plan_id: string; user_id: string }
        Update: Partial<Pick<MonthlyPlanFollower, "confirmed">>
        Relationships: []
      }
      monthly_plan_comments: {
        Row: MonthlyPlanComment
        Insert: Partial<MonthlyPlanComment> & { plan_id: string; created_by: string }
        Update: Partial<MonthlyPlanComment>
        Relationships: []
      }
      monthly_plan_attachments: {
        Row: MonthlyPlanAttachment
        Insert: Partial<MonthlyPlanAttachment> & {
          comment_id: string
          storage_path: string
          file_name: string
          created_by: string
        }
        Update: Partial<MonthlyPlanAttachment>
        Relationships: []
      }
      direct_messages: {
        Row: DirectMessage
        Insert: Partial<DirectMessage> & {
          sender_id: string
          recipient_id: string
          body: string
        }
        Update: Partial<Pick<DirectMessage, "read_at">>
        Relationships: []
      }
      chat_rooms: {
        Row: ChatRoom
        Insert: Partial<ChatRoom> & { name: string; created_by: string }
        Update: Partial<ChatRoom>
        Relationships: []
      }
      chat_room_members: {
        Row: ChatRoomMember
        Insert: Partial<ChatRoomMember> & { room_id: string; user_id: string }
        Update: Partial<Pick<ChatRoomMember, "last_read_at">>
        Relationships: []
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Partial<ChatMessage> & { room_id: string; sender_id: string; body: string }
        Update: Partial<ChatMessage>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      upsert_push_subscription: {
        Args: {
          p_store_id: string | null
          p_endpoint: string
          p_p256dh: string
          p_auth: string
        }
        Returns: void
      }
      get_push_subscriptions_for_user: {
        Args: {
          p_user_id: string
        }
        Returns: PushSubscriptionRow[]
      }
      verify_brand_admin_password: {
        Args: {
          p_brand_id: string
          p_attempt: string
        }
        Returns: boolean
      }
      get_daily_closings_totals: {
        Args: {
          p_start: string
          p_end: string
        }
        Returns: { date: string; store_id: string; grand_total: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
