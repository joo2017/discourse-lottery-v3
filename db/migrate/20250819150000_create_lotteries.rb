class CreateLotteries < ActiveRecord::Migration[6.1]
  def change
    # 增加一个前置条件检查，只有当表不存在时才执行创建操作
    unless table_exists?(:lotteries)
      create_table :lotteries do |t|
        # 关联信息
        t.integer :topic_id, null: false
        t.integer :post_id, null: false
        t.integer :user_id, null: false # 抽奖发起者的 user_id

        # 用户填写的抽奖核心参数
        t.string :prize_name, null: false, limit: 100         # 对应 "活动名称"
        t.text :prize_details, null: false, limit: 500        # 对应 "奖品说明"
        t.datetime :draw_time, null: false                    # 对应 "开奖时间"
        t.integer :winners_count, null: false, default: 1     # 对应 "获奖人数"
        t.integer :min_participants, null: false, default: 5  # 对应 "参与门槛"
        t.string :backup_strategy, null: false, default: 'continue' # 对应 "后备策略" ('continue' 或 'cancel')

        # 系统根据输入智能判断的字段
        t.string :lottery_type, null: false, default: 'random'       # 抽奖方式 ('random' 或 'specified')
        t.text :specified_post_numbers, null: true                  # 存储指定的楼层号，例如 "8,18,28"

        # 新增的可选字段
        t.text :additional_notes, null: true, limit: 300            # 补充说明
        t.string :prize_image, null: true, limit: 500               # 奖品图片URL

        # 由系统在后台自动管理的字段
        t.string :status, null: false, default: 'running'           # 抽奖状态: 'running', 'finished', 'cancelled'
        t.text :winner_user_ids, null: true                         # 存储中奖用户的ID列表，例如 "123,456"

        t.timestamps # 自动创建 created_at 和 updated_at 字段
      end

      # 为常用查询字段添加索引以优化性能
      add_index :lotteries, :topic_id, unique: true, name: 'index_lotteries_on_topic_id'
      add_index :lotteries, :status, name: 'index_lotteries_on_status'
      add_index :lotteries, :draw_time, name: 'index_lotteries_on_draw_time'
      add_index :lotteries, :user_id, name: 'index_lotteries_on_user_id'
      add_index :lotteries, [:status, :draw_time], name: 'index_lotteries_on_status_and_draw_time'

      # 添加外键约束（如果数据库支持）
      add_foreign_key :lotteries, :topics, on_delete: :cascade
      add_foreign_key :lotteries, :posts, on_delete: :cascade  
      add_foreign_key :lotteries, :users, on_delete: :cascade

      Rails.logger.info "LotteryPlugin: Created lotteries table with all indexes and foreign keys"
    else
      Rails.logger.info "LotteryPlugin: Lotteries table already exists, skipping creation"
      
      # 检查是否需要添加新字段（用于插件更新）
      unless column_exists?(:lotteries, :additional_notes)
        add_column :lotteries, :additional_notes, :text, limit: 300, null: true
        Rails.logger.info "LotteryPlugin: Added additional_notes column"
      end
      
      unless column_exists?(:lotteries, :prize_image) 
        add_column :lotteries, :prize_image, :string, limit: 500, null: true
        Rails.logger.info "LotteryPlugin: Added prize_image column"
      end
    end
  end

  def down
    if table_exists?(:lotteries)
      # 移除外键约束
      remove_foreign_key :lotteries, :topics if foreign_key_exists?(:lotteries, :topics)
      remove_foreign_key :lotteries, :posts if foreign_key_exists?(:lotteries, :posts)
      remove_foreign_key :lotteries, :users if foreign_key_exists?(:lotteries, :users)
      
      # 删除表
      drop_table :lotteries
      Rails.logger.info "LotteryPlugin: Dropped lotteries table"
    end
  end
end
