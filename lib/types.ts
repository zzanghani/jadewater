export type Role = 'owner' | 'staff'

export type Profile = {
  id: string
  email: string
  name: string
  role: Role
  store_id: string | null
  created_at: string
}

export type Store = {
  id: string
  name: string
  sort_order: number
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
  | 'payment_sales_total'
  | 'category_sales_total'
  | 'delivery_sales_total'
  | 'grand_total'

export type PaymentRequest = {
  id: string
  store_id: string
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

export type LineItem = {
  name: string
  amount: number
  note?: string
}

export type LaborItem = LineItem & {
  type: '정직원' | '파트타이머'
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
}

export type ScheduleRole = '점장' | '부점장' | '팀장' | '사원' | '파트타이머'

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
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
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
          store_id: string
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
        Update: Partial<Pick<BoardPost, "requester_confirmed" | "completed_at">>
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
