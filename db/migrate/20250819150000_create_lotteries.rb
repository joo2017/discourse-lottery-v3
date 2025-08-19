# file: discourse-lottery-v3/db/migrate/20250819150000_create_lotteries.rb

class CreateLotteries < ActiveRecord::Migration[6.1]
  def change
    create_table :lotteries do |t|
      # 关联信息
      t.integer :topic_id, null: false
      t.integer :post_id, null: false
      t.integer :user_id, null: false # 抽奖发起者的 user_id

      # 用户填写的抽奖核心参数
      t.string :prize_name, null: false         # 对应 "活动名称"
      t.text :prize_details, null: true          # 对应 "奖品说明"
      t.datetime :draw_time, null: false        # 对应 "开奖时间"
      t.integer :winners_count, null: false      # 对应 "获奖人数"
      t.integer :min_participants, null: false   # 对应 "参与门槛"
      t.string :backup_strategy, null: false    # 对应 "后备策略" ('continue' 或 'cancel')

      # 系统根据输入智能判断的字段
      t.string :lottery_type, null: false       # 抽奖方式 ('random' 或 'specified')
      t.text :specified_post_numbers, null: true # 存储指定的楼层号，例如 "8,18,28"

      # 由系统在后台自动管理的字段
      t.string :status, null: false, default: 'running' # 抽奖状态: 'running', 'finished', 'cancelled'
      t.text :winner_user_ids, null: true               # 存储中奖用户的ID列表，例如 "123,456"

      t.timestamps # 自动创建 created_at 和 updated_at 字段
    end

    # 为常用查询字段添加索引以优化性能
    add_index :lotteries, :topic_id, unique: true # 一个主题只能有一个抽奖
    add_index :lotteries, :status
  end
end
