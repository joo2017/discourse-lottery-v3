import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Correct sendAction lottery toolbar initializer starting...");
      
      // 检查分类是否允许抽奖
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

      // 处理抽奖数据提交
      function handleLotterySubmit(lotteryData) {
        console.log("🎲 Lottery data submitted:", lotteryData);
        
        const composer = api.container.lookup("controller:composer");
        if (!composer) return;

        // 缓存数据
        window.lotteryFormDataCache = lotteryData;
        
        // 插入占位符
        const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);
        
        console.log("🎲 Inserted lottery placeholder into composer");
      }

      // 修改 d-editor 组件以添加 action
      api.modifyClass("component:d-editor", {
        pluginId: "discourse-lottery-v3",
        
        actions: {
          openLotteryModalFromToolbar() {
            console.log("🎲 d-editor action: openLotteryModalFromToolbar");
            
            // 推荐方式：使用容器查找 composer 控制器
            let composer = null;
            
            // 方法1: 尝试通过 this.container
            if (this.container) {
              try {
                composer = this.container.lookup("controller:composer");
                console.log("🎲 Found composer via this.container");
              } catch (e) {
                console.log("🎲 this.container.lookup failed:", e.message);
              }
            }
            
            // 方法2: 尝试通过 getOwner (如果方法1失败)
            if (!composer && window.require) {
              try {
                const owner = window.require('discourse-common/lib/get-owner').default(this);
                composer = owner.lookup('controller:composer');
                console.log("🎲 Found composer via getOwner");
              } catch (e) {
                console.log("🎲 getOwner failed:", e.message);
              }
            }
            
            // 方法3: 使用全局 api.container (最后的备选方案)
            if (!composer) {
              try {
                composer = api.container.lookup("controller:composer");
                console.log("🎲 Found composer via api.container");
              } catch (e) {
                console.log("🎲 api.container.lookup failed:", e.message);
              }
            }
            
            if (composer) {
              console.log("🎲 Found composer controller, sending openLotteryModal");
              composer.send("openLotteryModal");
            } else {
              console.error("🎲 No composer controller found via any method");
              alert("无法找到编辑器控制器，请刷新页面后重试");
            }
          }
        }
      });

      // 修改 composer 控制器以添加模态框相关的 actions
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        // 添加状态跟踪
        lotteryModalVisible: false,

        actions: {
          openLotteryModal() {
            console.log("🎲 Composer action: openLotteryModal");
            
            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
              return;
            }

            // 尝试使用 modal service
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

            // 降级到简单表单
            console.log("🎲 Using fallback form");
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
            
            // 验证时间
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

      // 工具栏按钮 - 使用正确的 sendAction 方式
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Adding correct sendAction lottery button to toolbar");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          // 使用 sendAction 而不是 perform
          sendAction: () => {
            console.log("🎲 sendAction triggered - sending to d-editor");
            // 注意：context 这里是 d-editor 组件
            toolbar.context.send("openLotteryModalFromToolbar");
          },
          condition: () => canInsertLottery()
        });
        
        console.log("🎲 Correct sendAction lottery button added to toolbar");
      });

      console.log("🎲 Correct sendAction lottery toolbar setup completed");
    });
  },
};
