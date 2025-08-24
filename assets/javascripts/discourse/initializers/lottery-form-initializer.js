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
          console.log("🎲 Options:", options);
          console.log("🎲 Model state:", this.get("model"));
          console.log("🎲 Current custom_fields:", this.get("model.custom_fields"));
          
          // 检查是否有缓存的抽奖数据
          if (window.lotteryFormDataCache) {
            console.log("🎲 Found cached lottery form data");
            const formData = window.lotteryFormDataCache;
            console.log("🎲 Cached lottery form data:", formData);
            
            // 验证缓存数据是否有效
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Cache data is valid, saving to custom_fields");
              
              const model = this.get("model");
              console.log("🎲 Model before modification:", model);
              
              // 方法1：直接操作对象
              if (!model.custom_fields) {
                model.custom_fields = {};
                console.log("🎲 Created custom_fields object");
              }
              
              model.custom_fields.lottery = JSON.stringify(formData);
              console.log("🎲 Set lottery data:", model.custom_fields.lottery);
              
              // 方法2：使用 set 方法强制更新
              model.set("custom_fields", Object.assign({}, model.custom_fields));
              
              // 方法3：标记属性变化
              model.notifyPropertyChange("custom_fields");
              
              // 方法4：直接标记模型为脏
              if (model.set) {
                model.set("custom_fields.lottery", JSON.stringify(formData));
              }
              
              console.log("🎲 Final model custom_fields:", model.custom_fields);
              console.log("🎲 Model after all modifications:", model);
              
              // 清理缓存
              window.lotteryFormDataCache = null;
              console.log("🎲 Cache cleared");
            } else {
              console.log("🎲 Invalid cache data (missing required fields):", formData);
            }
          } else {
            console.log("🎲 No lottery cache found");
          }
          
          // 调用原始的 save 方法
          const result = this._super(options);
          console.log("🎲 Save result:", result);
          return result;
        }
      });
      
      // 调试：监听更多事件
      api.onAppEvent("composer:saved", () => {
        console.log("🎲 Composer saved event fired");
      });
      
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created event fired");
        console.log("🎲 Topic data:", topicData);
        console.log("🎲 Actual topic ID:", topicData.id);
        
        // 验证数据是否真的保存了
        setTimeout(() => {
          console.log("🎲 Checking if data was actually saved...");
          // 这里可以通过 AJAX 查询验证，但先不加复杂度
        }, 2000);
      });
    });
  },
};
