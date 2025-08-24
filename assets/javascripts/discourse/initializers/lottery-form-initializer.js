import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 修改 composer 控制器来保存抽奖数据到 custom_fields
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save called");
          console.log("🎲 Checking for lottery form data...");
          
          // 检查是否有缓存的抽奖数据
          if (window.lotteryFormDataCache) {
            console.log("🎲 Found cached lottery form data");
            const formData = window.lotteryFormDataCache;
            console.log("🎲 Cached lottery form data:", formData);
            
            // 验证缓存数据是否有效
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Cache data is valid, saving to custom_fields");
              
              const model = this.get("model");
              
              // 确保 custom_fields 存在
              if (!model.custom_fields) {
                model.custom_fields = {};
              }
              
              // 保存抽奖数据到 custom_fields
              model.custom_fields.lottery = JSON.stringify(formData);
              
              // 关键：标记 custom_fields 为脏数据，确保保存到数据库
              model.set("custom_fields", model.custom_fields);
              model.notifyPropertyChange("custom_fields");
              
              console.log("🎲 Lottery data saved to custom_fields");
              console.log("🎲 Final custom_fields:", model.custom_fields);
              
              // 清理缓存
              window.lotteryFormDataCache = null;
              console.log("🎲 Cache cleared");
            } else {
              console.log("🎲 Invalid cache data (missing required fields), skipping");
            }
          } else {
            console.log("🎲 No lottery cache found");
          }
          
          // 调用原始的 save 方法
          return this._super(options);
        }
      });
      
      // 调试用：监听 topic 创建事件，检查数据是否正确保存
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created event fired:", topicData);
        console.log("🎲 Topic ID:", topicData.id);
        
        // 这里不发送 AJAX 请求，只是用于调试
        console.log("🎲 Data should now be in topic custom_fields for backend processing");
      });
    });
  },
};
