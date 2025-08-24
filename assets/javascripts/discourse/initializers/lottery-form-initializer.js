import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 官方推荐：修改 topic 模型支持 custom_fields
      api.modifyClass("model:topic", {
        pluginId: "discourse-lottery-v3",
        
        custom_fields: {},
        
        asJSON() {
          const json = this._super(...arguments);
          json.custom_fields = this.custom_fields;
          return json;
        }
      });
      
      // 官方推荐：修改 createPost 方法传递数据到 opts
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        createPost(opts) {
          console.log("🎲 createPost called");
          
          // 检查是否有抽奖数据并且是新话题
          if (window.lotteryFormDataCache && this.get('creatingTopic')) {
            console.log("🎲 Found lottery data for new topic");
            const formData = window.lotteryFormDataCache;
            
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Valid lottery data, adding to opts");
              
              // 官方推荐：通过 opts 传递数据给 :topic_created 事件
              if (!opts) {
                opts = {};
              }
              
              opts.lottery_data = formData;
              
              console.log("🎲 Added lottery_data to opts:", opts.lottery_data);
              
              // 清理缓存
              window.lotteryFormDataCache = null;
              console.log("🎲 Cache cleared");
            }
          }
          
          // 调用原始方法
          return this._super(opts);
        }
      });
      
      // 监听话题创建成功
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created successfully:", topicData.id);
        
        // 延迟刷新显示结果
        setTimeout(() => {
          console.log("🎲 Refreshing to show lottery display");
          window.location.reload();
        }, 4000);
      });
    });
  },
};
