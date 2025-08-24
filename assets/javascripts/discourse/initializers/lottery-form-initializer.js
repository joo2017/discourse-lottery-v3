# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# 注册资源文件
register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"
register_asset "stylesheets/lottery-display.scss"

# 注册图标
register_svg_icon "dice"

# 添加路由
Discourse::Application.routes.draw do
  post "/admin/plugins/lottery/create" => "admin/plugins/lottery#create"
end

after_initialize do
  Rails.logger.info "LotteryPlugin: Starting initialization"
  
  # 加载模型和服务
  begin
    require_relative 'lib/lottery'
    Rails.logger.info "LotteryPlugin: Loaded lottery model"
  rescue => e
    Rails.logger.error "LotteryPlugin: Failed to load lottery model: #{e.message}"
  end
  
  begin
    require_relative 'lib/lottery_creator'
    Rails.logger.info "LotteryPlugin: Loaded lottery creator"
  rescue => e
    Rails.logger.error "LotteryPlugin: Failed to load lottery creator: #{e.message}"
  end
  
  # 定义模型关联
  if defined?(Topic)
    Topic.class_eval do
      has_many :lotteries, dependent: :destroy
    end
    Rails.logger.info "LotteryPlugin: Added lotteries association to Topic"
  end
  
  # 创建控制器
  class ::Admin::Plugins::LotteryController < ::Admin::AdminController
    def create
      Rails.logger.info "LotteryController: Received lottery creation request"
      Rails.logger.info "LotteryController: Params: #{params}"
      
      topic_id = params[:topic_id]
      lottery_data = params[:lottery_data]
      
      unless topic_id && lottery_data
        render json: { error: "Missing required parameters" }, status: 400
        return
      end
      
      begin
        topic = Topic.find(topic_id)
        user = current_user
        
        Rails.logger.info "LotteryController: Creating lottery for topic #{topic_id}"
        Rails.logger.info "LotteryController: Data: #{lottery_data}"
        
        # 直接创建抽奖
        lottery = LotteryCreator.new(topic, lottery_data, user).create
        
        Rails.logger.info "LotteryController: Successfully created lottery #{lottery.id}"
        
        render json: { 
          success: true, 
          lottery_id: lottery.id,
          message: "抽奖创建成功"
        }
        
      rescue => e
        Rails.logger.error "LotteryController: Error: #{e.message}"
        Rails.logger.error "LotteryController: Backtrace: #{e.backtrace.join("\n")}"
        
        render json: { 
          error: "创建失败: #{e.message}" 
        }, status: 500
      end
    end
  end
  
  Rails.logger.info "LotteryPlugin: Initialization completed"
end
