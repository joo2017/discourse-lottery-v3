import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 不再修改 createPost，不使用 window 缓存
      // 直接在 Modal submit 时设置 composer.customFields
      
      // 提供全局方法供 Modal 调用
      window.setLotteryToComposer = function(lotteryData) {
        console.log("🎲 Setting lottery data to composer.customFields");
        console.log("🎲 Data:", lotteryData);
        
        try {
          const composer = api.container.lookup("service:composer");
          
          if (!composer) {
            console.error("🎲 ❌ Could not get composer service");
            return false;
          }
          
          // 官方推荐：直接设置到 composer.customFields
          if (!composer.customFields) {
            composer.customFields = {};
          }
          
          composer.customFields.lottery = {
            prize_name: lotteryData.prize_name,
            prize_details: lotteryData.prize_details,
            draw_time: lotteryData.draw_time,
            winners_count: lotteryData.winners_count,
            specified_posts: lotteryData.specified_posts || "",
            min_participants: lotteryData.min_participants,
            backup_strategy: lotteryData.backup_strategy,
            additional_notes: lotteryData.additional_notes || "",
            prize_image: lotteryData.prize_image || ""
          };
          
          console.log("🎲 ✅ Set composer.customFields.lottery:", composer.customFields.lottery);
          
          // 同时插入 BBCode 到编辑器（用于显示）
          const placeholder = buildLotteryPlaceholder(lotteryData);
          const currentText = composer.model.reply || "";
          composer.model.reply = currentText + placeholder;
          
          console.log("🎲 ✅ Also inserted BBCode placeholder");
          
          return true;
          
        } catch (error) {
          console.error("🎲 ❌ Error setting lottery data:", error);
          return false;
        }
      };
      
      // 辅助函数：构建占位符
      function buildLotteryPlaceholder(data) {
        let placeholder = `\n[lottery]\n`;
        placeholder += `活动名称：${data.prize_name}\n`;
        placeholder += `奖品说明：${data.prize_details}\n`;
        placeholder += `开奖时间：${data.draw_time}\n`;
        
        if (data.specified_posts && data.specified_posts.trim()) {
          placeholder += `抽奖方式：指定楼层\n`;
          placeholder += `指定楼层：${data.specified_posts}\n`;
        } else {
          placeholder += `抽奖方式：随机抽取\n`;
          placeholder += `获奖人数：${data.winners_count}\n`;
        }
        
        placeholder += `参与门槛：${data.min_participants}人\n`;
        
        if (data.additional_notes && data.additional_notes.trim()) {
          placeholder += `补充说明：${data.additional_notes}\n`;
        }
        
        placeholder += `[/lottery]\n\n`;
        return placeholder;
      }
      
      // 监听话题创建成功
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created successfully:", topicData.id);
        
        // 延迟刷新显示结果
        setTimeout(() => {
          console.log("🎲 Refreshing to show lottery display");
          window.location.reload();
        }, 3000);
      });
    });
  },
};
