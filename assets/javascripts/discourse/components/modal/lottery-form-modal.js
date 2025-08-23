import Controller from "@ember/controller";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { action } from "@ember/object";

export default Controller.extend(ModalFunctionality, {
  // 表单数据
  prizeName: "",
  prizeDetails: "",
  drawTime: "",
  winnersCount: 1,
  specifiedPosts: "",
  minParticipants: 5,
  backupStrategy: "continue",
  additionalNotes: "",

  // 状态
  isLoading: false,

  onShow() {
    console.log("🎲 抽奖表单模态框显示");
    // 初始化表单
    this.setProperties({
      prizeName: "",
      prizeDetails: "",
      drawTime: "",
      winnersCount: 1,
      specifiedPosts: "",
      minParticipants: this.get("model.siteSettings.lottery_min_participants_global") || 5,
      backupStrategy: "continue",
      additionalNotes: "",
      isLoading: false
    });

    // 设置默认开奖时间（1小时后）
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    const timeString = defaultTime.toISOString().slice(0, 16);
    this.set("drawTime", timeString);
  },

  // 验证表单
  isValid() {
    const hasRequired = this.prizeName && this.prizeDetails && this.drawTime;
    const validMinParticipants = this.minParticipants >= (this.get("model.siteSettings.lottery_min_participants_global") || 5);
    return hasRequired && validMinParticipants;
  },

  @action
  submit() {
    console.log("🎲 提交抽奖表单");

    if (!this.isValid()) {
      this.flash("请填写所有必填字段", "error");
      return;
    }

    // 验证时间
    const drawDate = new Date(this.drawTime);
    if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
      this.flash("开奖时间必须是未来时间", "error");
      return;
    }

    // 验证参与门槛
    const globalMin = this.get("model.siteSettings.lottery_min_participants_global") || 5;
    if (this.minParticipants < globalMin) {
      this.flash(`参与门槛不能低于全局设置的 ${globalMin} 人`, "error");
      return;
    }

    this.set("isLoading", true);

    // 构建抽奖数据
    const lotteryData = {
      prize_name: this.prizeName.trim(),
      prize_details: this.prizeDetails.trim(),
      draw_time: this.drawTime.trim(),
      winners_count: this.winnersCount,
      specified_posts: this.specifiedPosts.trim(),
      min_participants: this.minParticipants,
      backup_strategy: this.backupStrategy,
      additional_notes: this.additionalNotes.trim()
    };

    console.log("🎲 抽奖数据:", lotteryData);

    try {
      // 缓存数据供后续使用
      window.lotteryFormDataCache = lotteryData;

      // 获取编辑器并插入内容
      const composer = this.get("model.composer");
      if (composer) {
        const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);

        console.log("🎲 抽奖内容插入成功");
        
        // 关闭模态框
        this.send("closeModal");
      } else {
        this.flash("无法获取编辑器", "error");
      }
    } catch (error) {
      console.error("🎲 插入抽奖内容失败:", error);
      this.flash("插入失败：" + error.message, "error");
    } finally {
      this.set("isLoading", false);
    }
  },

  @action
  cancel() {
    console.log("🎲 取消抽奖表单");
    this.send("closeModal");
  }
});
