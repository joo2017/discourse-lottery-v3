# db/migrate/20250830000000_create_lotteries.rb

class CreateLotteries < ActiveRecord::Migration[7.0]
  def change
    # 检查表是否已存在，避免重复创建
    unless table_exists?(:lotteries)
      create_table :lotteries do |t|
        # 关联字段
        t.references :topic, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
        t.references :post, null: false, foreign_key: { on_delete: :cascade }
        t.references :user, null: false, foreign_key: { on_delete: :cascade }

        # 用户填写的抽奖核心参数
        t.string :prize_name, null: false, limit: 100
        t.text :prize_details, null: false, limit: 500
        t.datetime :draw_time, null: false
        t.integer :winners_count, null: false, default: 1
        t.integer :min_participants, null: false, default: 5
        t.string :backup_strategy, null: false, default: 'continue'

        # 系统智能判断的字段
        t.string :lottery_type, null: false, default: 'random'
        t.text :specified_post_numbers, null: true

        # 可选字段
        t.text :additional_notes, null: true, limit: 300
        t.string :prize_image, null: true, limit: 500

        # 系统管理字段
        t.string :status, null: false, default: 'running'
        t.text :winner_user_ids, null: true

        t.timestamps
      end

      # 添加性能索引
      add_index :lotteries, :status
      add_index :lotteries, :draw_time
      add_index :lotteries, [:status, :draw_time], name: 'index_lotteries_on_status_and_draw_time'

      Rails.logger.info "LotteryPlugin: Created lotteries table with proper structure"
    else
      Rails.logger.info "LotteryPlugin: Lotteries table already exists"
      
      # 检查并添加可能缺失的列
      add_missing_columns_if_needed
    end
  end

  def down
    if table_exists?(:lotteries)
      drop_table :lotteries
      Rails.logger.info "LotteryPlugin: Dropped lotteries table"
    end
  end

  private

  def add_missing_columns_if_needed
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
