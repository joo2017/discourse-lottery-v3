import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 关键修复：修改 composer 控制器的 save 方法
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save() {
          console.log("🎲 Composer controller save called");
          
          // 在保存前设置 custom_fields
          if (window.lotteryFormDataCache && !this.get("model.editingPost")) {
            console.log("🎲 Found lottery cache, setting custom_fields before save");
            const formData = window.lotteryFormDataCache;
            
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Valid lottery data, setting to model");
              
              const model = this.get("model");
              
              // 确保 custom_fields 存在
              if (!model.custom_fields) {
                model.set("custom_fields", {});
              }
              
              // 设置抽奖数据
              model.set("custom_fields.has_lottery", true);
              model.set("custom_fields.lottery_name", formData.prize_name);
              model.set("custom_fields.lottery_details", formData.prize_details);
              model.set("custom_fields.lottery_time", formData.draw_time);
              model.set("custom_fields.lottery_winners", formData.winners_count);
              model.set("custom_fields.lottery_min", formData.min_participants);
              model.set("custom_fields.lottery_strategy", formData.backup_strategy);
              model.set("custom_fields.lottery_notes", formData.additional_notes || "");
              model.set("custom_fields.lottery_posts", formData.specified_posts || "");
              
              console.log("🎲 Set custom_fields:", model.get("custom_fields"));
              
              // 强制标记为脏数据
              model.notifyPropertyChange("custom_fields");
              
              // 清理缓存
              window.lotteryFormDataCache = null;
              console.log("🎲 Cache cleared");
            }
          }
          
          // 调用原始保存方法
          return this._super(...arguments);
        }
      });
      
      // 监听话题创建成功
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created successfully");
        console.log("🎲 Event data:", topicData);
        console.log("🎲 Current URL:", window.location.href);
        
        // 从URL获取真实的话题ID
        const urlMatch = window.location.href.match(/\/t\/[^/]+\/(\d+)/);
        const realTopicId = urlMatch ? urlMatch[1] : topicData.id;
        
        console.log("🎲 Real topic ID:", realTopicId);
        
        // 验证数据是否保存
        setTimeout(() => {
          console.log("🎲 Verifying data was saved...");
          
          fetch(`/t/${realTopicId}.json`)
            .then(response => response.json())
            .then(data => {
              console.log("🎲 Server response:", data);
              
              if (data.details && data.details.custom_fields) {
                console.log("🎲 Custom fields from server:", data.details.custom_fields);
                
                if (data.details.custom_fields.has_lottery) {
                  console.log("🎲 ✅ SUCCESS: Lottery data found!");
                  console.log("🎲 Prize name:", data.details.custom_fields.lottery_name);
                } else {
                  console.log("🎲 ❌ FAIL: No lottery data in custom_fields");
                }
              } else {
                console.log("🎲 ❌ FAIL: No custom_fields in response");
              }
            })
            .catch(error => {
              console.log("🎲 Error checking data:", error);
            });
        }, 3000);
        
        // 刷新页面显示结果
        setTimeout(() => {
          console.log("🎲 Refreshing to show processed lottery");
          window.location.reload();
        }, 6000);
      });
    });
  },
};
