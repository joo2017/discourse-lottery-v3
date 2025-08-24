import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 方法1：通过 composer 的 save 事件
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save intercepted");
          
          // 检查是否有缓存的抽奖数据
          if (window.lotteryFormDataCache) {
            console.log("🎲 Found lottery cache data:", window.lotteryFormDataCache);
            
            const formData = window.lotteryFormDataCache;
            
            // 验证数据完整性
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Lottery data is valid, preparing to save");
              
              // 确保模型存在
              const model = this.get("model");
              if (model) {
                // 方式1：直接设置到模型
                if (!model.custom_fields) {
                  model.set("custom_fields", {});
                }
                model.set("custom_fields.lottery", JSON.stringify(formData));
                
                // 方式2：添加到 metaData（如果模型支持）
                if (model.metaData) {
                  model.metaData.lottery = JSON.stringify(formData);
                }
                
                console.log("🎲 Set lottery data in model custom_fields");
                console.log("🎲 Model custom_fields:", model.custom_fields);
                
                // 清理缓存
                window.lotteryFormDataCache = null;
                console.log("🎲 Cleared cache");
              } else {
                console.error("🎲 No composer model found");
              }
            } else {
              console.log("🎲 Invalid lottery data, skipping");
            }
          }
          
          return this._super(options);
        }
      });

      // 方法2：通过 topic 创建事件（备选方案）
      api.onAppEvent("topic:created", (data) => {
        console.log("🎲 Topic created event fired:", data);
        
        if (window.lotteryFormDataCache) {
          console.log("🎲 Sending lottery data via AJAX");
          
          const formData = window.lotteryFormDataCache;
          
          // 通过 AJAX 直接发送数据到后端
          fetch(`/t/${data.id}/lottery`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            },
            body: JSON.stringify({
              lottery_data: formData
            })
          }).then(response => {
            if (response.ok) {
              console.log("🎲 Lottery data sent successfully");
            } else {
              console.error("🎲 Failed to send lottery data");
            }
            // 清理缓存
            window.lotteryFormDataCache = null;
          }).catch(error => {
            console.error("🎲 Error sending lottery data:", error);
            window.lotteryFormDataCache = null;
          });
        }
      });
    });
  },
};
