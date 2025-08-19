class CreateLotteries < ActiveRecord::Migration[6.0]
  def change
    create_table :lotteries do |t|
      t.integer :topic_id, null: false
      t.integer :post_id, null: false
      t.integer :user_id, null: false
      t.datetime :draw_time, null: false
      t.string :status, null: false, default: 'running' # running, finished, cancelled
      t.integer :winners_count, null: false
      t.string :prize, null: false
      t.text :prize_description
      t.string :lottery_type, null: false # random, specified
      t.text :specified_post_numbers # 存储"8,18,28"
      t.integer :min_participants, null: false
      t.string :backup_strategy, null: false # continue, cancel
      t.text :winner_ids # 存储中奖用户的ID
      t.timestamps
    end

    add_index :lotteries, :topic_id, unique: true
    add_index :lotteries, :status
  end
end
