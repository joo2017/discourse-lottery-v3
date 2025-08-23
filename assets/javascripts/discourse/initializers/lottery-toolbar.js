import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery toolbar initializing...");

      // 判断当前分类是否允许抽奖
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;

        const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
        if (!allowedCategories) return false;

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.includes(currentCategoryId);
      }

      // 处理抽奖数据
      function handleLotterySubmit(lotteryData) {
        console.log("🎲 Lottery data submitted:", lotteryData);

        const composer = api.container.lookup("controller:composer");
        if (!composer) return;

        window.lotteryFormDataCache = lotteryData;

        const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);

        console.log("🎲 Inserted lottery placeholder into composer");
      }

      // 扩展 composer controller，添加 action 逻辑
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        lotteryModalVisible: false,

        actions: {
          openLotteryModal() {
            console.log("🎲 Composer action: openLotteryModal");

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
              return;
            }

            // 优先弹出自定义模态框
            try {
              const modal = this.modal;
              if (modal && modal.show) {
                console.log("🎲 Using modal service to show lottery modal");

                modal.show("modal/lottery-modal", {
                  model: {
                    onSubmit: handleLotterySubmit
                  }
                }).then((result) => {
                  console.log("🎲 Modal closed with result:", result);
                  if (result && result.prize_name) {
                    handleLotterySubmit(result);
                  }
                }).catch((error) => {
                  console.log("🎲 Modal closed or error:", error);
                });

                return;
              }
            } catch (e) {
              console.log("🎲 Modal service failed:", e.message);
            }

            // 降级用prompt
            console.log("🎲 Using fallback lottery form");
            this.send("showFallbackLotteryForm");
          },

          showFallbackLotteryForm() {
            console.log("🎲 Showing fallback lottery form");

            const prizeName = prompt("📝 请输入活动名称：");
            if (!prizeName || !prizeName.trim()) return;

            const prizeDetails = prompt("🎁 请输入奖品说明：");
            if (!prizeDetails || !prizeDetails.trim()) return;

            const drawTime = prompt("⏰ 请输入开奖时间 (格式: 2025-08-25T20:00)：");
            if (!drawTime || !drawTime.trim()) return;

            try {
              const testDate = new Date(drawTime);
              if (isNaN(testDate.getTime()) || testDate <= new Date()) {
                alert("时间格式无效或不能是过去时间");
                return;
              }
            } catch (e) {
              alert("时间格式无效");
              return;
            }

            const lotteryData = {
              prize_name: prizeName.trim(),
              prize_details: prizeDetails.trim(),
              draw_time: drawTime.trim(),
              winners_count: 1,
              specified_posts: "",
              min_participants: this.siteSettings?.lottery_min_participants_global || 5,
              backup_strategy: "continue",
              additional_notes: ""
            };

            handleLotterySubmit(lotteryData);
          },

          closeLotteryModal(result) {
            console.log("🎲 Composer action: closeLotteryModal with result:", result);

            if (result && result.prize_name) {
              handleLotterySubmit(result);
            }
            this.set('lotteryModalVisible', false);
          }
        }
      });

      // 仅在编辑器打开&当前分类允许抽奖时显示按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Adding lottery button to toolbar");
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          sendAction: () => {
            console.log("🎲 lottery toolbar sendAction fired");
            const composer = api.container.lookup("controller:composer");
            console.log("🎲 composer lookup result:", composer);
            if (composer && typeof composer.send === "function") {
              composer.send("openLotteryModal");
            } else if (!composer) {
              alert("请先新建主题或回复后，再使用抽奖按钮。");
            } else {
              alert("composer 控制器不可用，请刷新页面后重试。");
            }
          },
          condition: () => {
            const composer = api.container.lookup("controller:composer");
            return !!composer && canInsertLottery();
          }
        });
      });

      console.log("🎲 Lottery toolbar setup completed");
    });
  },
};
