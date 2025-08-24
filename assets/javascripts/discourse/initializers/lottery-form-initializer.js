import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 监听话题创建成功事件
      api.onAppEvent("topic:created", async (topicData) => {
        console.log("🎲 Topic created successfully:", topicData.id);
        
        // 检查是否有待处理的抽奖数据
        if (window.lotteryFormDataCache) {
          console.log("🎲 Found lottery cache data, updating topic custom_fields");
          const formData = window.lotteryFormDataCache;
          
          if (formData.prize_name && formData.prize_details && formData.draw_time) {
            console.log("🎲 Valid lottery data, updating via official API");
            
            try {
              // 使用 Discourse 官方的 Topic API 更新 custom_fields
              const response = await fetch(`/t/${topicData.id}.json`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({
                  topic: {
                    custom_fields: {
                      lottery_name: formData.prize_name,
                      lottery_details: formData.prize_details,
                      lottery_time: formData.draw_time,
                      lottery_winners: formData.winners_count.toString(),
                      lottery_min: formData.min_participants.toString(),
                      lottery_strategy: formData.backup_strategy,
                      lottery_notes: formData.additional_notes || "",
                      lottery_posts: formData.specified_posts || "",
                      has_lottery: "true"
                    }
                  }
                })
              });
              
              if (response.ok) {
                console.log("🎲 ✅ Successfully updated topic custom_fields");
                
                // 清理缓存
                window.lotteryFormDataCache = null;
                console.log("🎲 Cache cleared");
                
              } else {
                console.log("🎲 ❌ Failed to update custom_fields:", response.status);
              }
              
            } catch (error) {
              console.log("🎲 ❌ Error updating custom_fields:", error);
            }
          }
        }
      });
    });
  },
};
