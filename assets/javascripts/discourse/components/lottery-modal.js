import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  // 注入服务
  modal: service(),
  siteSettings: service(),

  // 初始化属性
  init() {
    this._super(...arguments);
    this.setProperties({
      prizeName: "",
      prizeDetails: "",
      drawTime: "",
      winnersCount: 1,
      specifiedPosts: "",
      minParticipants: this.siteSettings.lottery_min_participants_global || 5,
      backupStrategy: "continue",
      additionalNotes: "",
      errors: {}
    });
  },

  @discourseComputed("prizeName", "prizeDetails", "drawTime", "minParticipants")
  isValid(prizeName, prizeDetails, drawTime, minParticipants) {
    const globalMin = this.siteSettings.lottery_min_participants_global || 5;
    return (
      prizeName && prizeName.trim() &&
      prizeDetails && prizeDetails.trim() &&
      drawTime && drawTime.trim() &&
      minParticipants >= globalMin
    );
  },

  @discourseComputed("specifiedPosts")
  lotteryType(specifiedPosts) {
    return specifiedPosts && specifiedPosts.trim() ? "指定楼层" : "随机抽取";
  },

  @action
  updatePrizeName(value) {
    this.set("prizeName", value);
    this.clearError("prizeName");
  },

  @action
  updatePrizeDetails(value) {
    this.set("prizeDetails", value);
    this.clearError("prizeDetails");
  },

  @action
  updateDrawTime(value) {
    this.set("drawTime", value);
    this.clearError("drawTime");
  },

  @action
  updateWinnersCount(value) {
    this.set("winnersCount", parseInt(value) || 1);
  },

  @action
  updateSpecifiedPosts(value) {
    this.set("specifiedPosts", value);
  },

  @action
  updateMinParticipants(value) {
    this.set("minParticipants", parseInt(value) || 1);
    this.clearError("minParticipants");
  },

  @action
  updateBackupStrategy(value) {
    this.set("backupStrategy", value);
  },

  @action
  updateAdditionalNotes(value) {
    this.set("additionalNotes", value);
  },

  clearError(field) {
    const errors = this.errors;
    if (errors[field]) {
      delete errors[field];
      this.set("errors", { ...errors });
    }
  },

  @action
  validateAndSubmit() {
    const errors = {};

    // 验证必填字段
    if (!this.prizeName || !this.prizeName.trim()) {
      errors.prizeName = "活动名称不能为空";
    }
    if (!this.prizeDetails || !this.prizeDetails.trim()) {
      errors.prizeDetails = "奖品说明不能为空";
    }
    if (!this.drawTime || !this.drawTime.trim()) {
      errors.drawTime = "开奖时间不能为空";
    }

    // 验证时间格式
    if (this.drawTime && this.drawTime.trim()) {
      try {
        const testDate = new Date(this.drawTime);
        if (isNaN(testDate.getTime()) || testDate <= new Date()) {
          errors.drawTime = "开奖时间无效或不能是过去时间";
        }
      } catch (e) {
        errors.drawTime = "时间格式无效";
      }
    }

    // 验证最小参与人数
    const globalMin = this.siteSettings.lottery_min_participants_global || 5;
    if (this.minParticipants < globalMin) {
      errors.minParticipants = `参与门槛不能低于${globalMin}人`;
    }

    // 如果有错误，显示错误
    if (Object.keys(errors).length > 0) {
      this.set("errors", errors);
      return;
    }

    // 清除错误
    this.set("errors", {});

    // 创建抽奖数据
    const lotteryData = {
      prize_name: (this.prizeName || "").trim(),
      prize_details: (this.prizeDetails || "").trim(),
      draw_time: (this.drawTime || "").trim(),
      winners_count: this.winnersCount || 1,
      specified_posts: (this.specifiedPosts || "").trim(),
      min_participants: this.minParticipants || 5,
      backup_strategy: this.backupStrategy || "continue",
      additional_notes: (this.additionalNotes || "").trim()
    };

    console.log("🎲 Lottery form validation passed, submitting:", lotteryData);

    // 调用回调函数
    if (this.model && this.model.onSubmit) {
      this.model.onSubmit(lotteryData);
    }

    // 关闭模态框
    this.send("closeModal", lotteryData);
  },

  @action
  closeModal(result) {
    console.log("🎲 Closing modal with result:", result);
    this.modal.close(result);
  }
});
