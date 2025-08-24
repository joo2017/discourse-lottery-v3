import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 官方推荐：修改 topic 模型以支持 custom_fields
      api.modifyClass("model:topic", {
        pluginId: "discourse-lottery-v3",
        
        // 确保 custom_fields 被初始化
        init() {
          this._super(...arguments);
          if (!this.custom_fields) {
            this.custom_fields = {};
          }
        },
        
        // 官方推荐：确保 custom_fields 在 JSON 序列化时被包含
        asJSON() {
          const json = this._super(...arguments);
          json.custom_fields = this.custom_fields;
          return json;
        }
      });
      
      // 官方推荐：修改 composer 模型来设置 custom_fields
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        // 在创建话题时设置 custom_fields
        createTopic() {
          console.log("🎲 createTopic called");
          
          // 检查是否有抽奖数据
          if (window.lotteryFormDataCache && !this.editingPost) {
            console.log("🎲 Found lottery data, setting to topic model");
            const formData = window.lotteryFormDataCache;
            
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Valid lottery data, setting custom_fields");
              
              // 获取或创建 topic 模型
              if (!this.topic) {
                this.set('topic', this.store.createRecord('topic'));
              }
              
              const topic = this.topic;
              
              // 确保 custom_fields 存在
              if (!topic.custom_fields) {
                topic.custom_fields = {};
              }
              
              // 设置抽奖相关的 custom_fields
              topic.custom_fields.has_lottery = true;
              topic.custom_fields.lottery_name = formData.prize_name;
              topic.custom_fields.lottery_details = formData.prize_details;
              topic.custom_fields.lottery_time = formData.draw_time;
              topic.custom_fields.lottery_winners = formData.winners_count;
              topic.custom_fields.lottery_min = formData.min_participants;
              topic.custom_fields.lottery_strategy = formData.backup_strategy;
              topic.custom_fields.lottery_notes = formData.additional_notes || "";
              topic.custom_fields.lottery_posts = formData.specified_posts || "";
              
              console.log("🎲 Set topic custom_fields:", topic.custom_fields);
              
              // 清理缓存
              window.lotteryFormDataCache = null;
              console.log("🎲 Cache cleared");
            }
          }
          
          // 调用原始方法
          return this._super(...arguments);
        }
      });
      
      // 监听成功创建
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created successfully:", topicData.id);
        
        // 延迟刷新以显示处理结果
        setTimeout(() => {
          console.log("🎲 Refreshing page to show lottery display");
          window.location.reload();
        }, 3000);
      });
    });
  },
};
