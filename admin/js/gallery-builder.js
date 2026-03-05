jQuery(document).ready(function ($) {
  let galleryBuilder = {
    orderHistory: [],
    currentOrderType: null,
    viewMode: "grid", // 'grid' | 'list'
    listState: {
      grouping: "first-word", // 'first-word' | 'none'
      collapsedGroups: new Set(),
      selectedIds: new Set(),
    },

    init: function () {
      this.initSortable()
      this.bindEvents()
      this.updatePreview()
      this.saveCurrentOrder() // Save initial order for undo
      this.maybeInitListView()
      this.loadExistingImageSizing() // Load grid sizing for existing images
      this.loadExistingVideoSettings() // Load video settings for existing videos
      this.populateCategoryDropdowns() // Populate category dropdowns from settings
      this.loadImageCategories() // Load existing category assignments
      this.bindCategorySave() // Bind category save on post save
      this.bindVideoSettings() // Bind video settings change handlers
    },

    initSortable: function () {
      $("#gallery-preview").sortable({
        items: ".gallery-item",
        placeholder: "gallery-item-placeholder",
        start: function () {
          galleryBuilder.saveCurrentOrder()
        },
        update: function () {
          galleryBuilder.clearActiveOrderingButtons()
          galleryBuilder.updateImageOrder()
        },
      })
    },

    bindEvents: function () {
      $("#add-images").on("click", this.openMediaUploader)
      $("#clear-gallery").on("click", this.clearGallery)
      $(document).on("click", ".remove-item", this.removeItem)
      $(document).on("click", ".size-btn", this.updateMasonrySize)
      $(document).on("click", ".grid-apply-btn", this.applyGridSizing)
      $(document).on("click", ".copy-shortcode", this.copyShortcode)

      // Ordering controls
      $("#reverse-order").on("click", this.reverseOrder)
      $("#randomize-order").on("click", this.randomizeOrder)
      $("#sort-filename-asc").on("click", this.sortByFilename)
      $("#sort-filename-desc").on("click", this.sortByFilename)
      $("#undo-order").on("click", this.undoOrder)

      // Watch for settings changes
      $("#columns, #masonry_enabled").on("change", this.updatePreview)

      // View toggle
      $(document).on("click", ".view-toggle", (e) => {
        e.preventDefault()
        const view = $(e.currentTarget).data("view")
        galleryBuilder.switchView(view)
      })

      // Grouping controls
      $(document).on("change", "#gallery-grouping", (e) => {
        galleryBuilder.listState.grouping = $(e.currentTarget).val()
        galleryBuilder.buildListView()
      })
      $(document).on("click", "#collapse-all-groups", (e) => {
        e.preventDefault()
        galleryBuilder.listState.collapsedGroups = new Set(galleryBuilder.getAllGroupKeys())
        galleryBuilder.renderListGroups()
      })
      $(document).on("click", "#expand-all-groups", (e) => {
        e.preventDefault()
        galleryBuilder.listState.collapsedGroups.clear()
        galleryBuilder.renderListGroups()
      })
      // Toggle single group
      $(document).on("click", ".group-header .toggle", function (e) {
        e.preventDefault()
        const key = $(this).closest(".group").data("group-key")
        if (galleryBuilder.listState.collapsedGroups.has(key)) {
          galleryBuilder.listState.collapsedGroups.delete(key)
        } else {
          galleryBuilder.listState.collapsedGroups.add(key)
        }
        galleryBuilder.renderListGroups()
      })
      // Row selection for multi-drag
      $(document).on("click", ".list-row", function (e) {
        const id = $(this).data("id")
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          // toggle selection
          if (galleryBuilder.listState.selectedIds.has(id)) {
            galleryBuilder.listState.selectedIds.delete(id)
          } else {
            galleryBuilder.listState.selectedIds.add(id)
          }
        } else {
          // single select
          galleryBuilder.listState.selectedIds.clear()
          galleryBuilder.listState.selectedIds.add(id)
        }
        galleryBuilder.updateRowSelectionStyles()
      })
    },

    updatePreview: function () {
      const preview = $("#gallery-preview")
      const columns = $("#columns").val() || 4
      const masonryEnabled = $("#masonry_enabled").is(":checked")

      // Remove existing column classes
      preview.removeClass("columns-2 columns-3 columns-4 columns-5 columns-6")
      preview.removeClass("masonry-enabled")

      // Add current column class
      preview.addClass("columns-" + columns)

      // Add masonry class if enabled
      if (masonryEnabled) {
        preview.addClass("masonry-enabled")
      }

      // Update preview settings indicator
      galleryBuilder.updatePreviewSettings()
    },

    // ===== List View Helpers =====
    maybeInitListView: function () {
      // Prepare data attributes on grid items for list view building
      $("#gallery-preview .gallery-item").each(function () {
        const $item = $(this)
        // Pull filename text if present in admin markup; else derive from img src
        let filename = $item.find(".image-filename").text().trim()
        if (!filename) {
          const src = $item.find("img").attr("src") || ""
          try {
            filename = decodeURIComponent(src.split("/").pop().split("?")[0])
          } catch (err) {
            filename = src.split("/").pop()
          }
        }
        $item.attr("data-filename", filename)
      })
    },

    loadExistingImageSizing: function () {
      // Load grid sizing for all existing images on page load
      $("#gallery-preview .gallery-item").each(function () {
        const imageId = $(this).data("id")
        if (imageId) {
          galleryBuilder.loadMasonrySize(imageId)
        }
      })
    },

    switchView: function (view) {
      if (view === this.viewMode) return
      this.viewMode = view
      $(".view-toggle").removeClass("active")
      $('.view-toggle[data-view="' + view + '"]').addClass("active")
      if (view === "list") {
        $("#gallery-preview").hide()
        $("#gallery-list-view").show()
        $(".grouping-controls").show()
        this.buildListView()
      } else {
        $("#gallery-list-view").hide()
        $(".grouping-controls").hide()
        $("#gallery-preview").show()
        // reflect any list reordering to grid if needed
        this.syncGridToHiddenOrder()
      }
    },

    getAllGroupKeys: function () {
      const items = this.collectItemsForList()
      const keys = new Set()
      items.forEach((it) => keys.add(it.groupKey))
      return Array.from(keys)
    },

    collectItemsForList: function () {
      const items = []
      $("#gallery-preview .gallery-item").each(function () {
        const $el = $(this)
        const id = $el.data("id") || $el.data("image-id") || $el.attr("data-id") || $el.attr("data-image-id")
        const filename = $el.attr("data-filename") || ""
        const sizeClass = ($el.attr("class") || "").match(/size-(regular|tall|wide|large|xl)/)
        const size = sizeClass ? sizeClass[1] : "regular"
        const groupKey = galleryBuilder.computeGroupKey(filename)
        items.push({ id, filename, size, groupKey })
      })
      return items
    },

    computeGroupKey: function (filename) {
      if (this.listState.grouping === "none") return "All"
      // Derive a stable prefix:
      // 1) strip extension
      // 2) remove trailing (digits) e.g., "(63)"
      // 3) remove trailing -digits/_digits/ space digits e.g., "-63", "_63", " 63"
      let base = (filename || "").replace(/\.[a-z0-9]+$/i, "")
      base = base.replace(/\s*\(\d+\)\s*$/i, "")
      base = base.replace(/[\s_-]*\d+\s*$/i, "")
      base = base.trim()
      if (!base) {
        base = filename || "Untitled"
      }
      return base
    },

    buildListView: function () {
      // Build data model from current grid order
      const items = this.collectItemsForList()
      // Group (case-insensitive key); preserve first-seen display label
      const groups = {}
      const labels = {}
      items.forEach((it) => {
        const norm = String(it.groupKey || "").toLowerCase()
        if (!groups[norm]) {
          groups[norm] = []
          labels[norm] = it.groupKey
        }
        groups[norm].push(it)
      })
      // Store on DOM for render
      $("#gallery-group-list").data("groups", { groups, labels })
      this.renderListGroups()
      this.initListSortables()
    },

    renderListGroups: function () {
      const $wrap = $("#gallery-group-list")
      const store = $wrap.data("groups") || { groups: {}, labels: {} }
      const groups = store.groups || {}
      const labels = store.labels || {}
      $wrap.empty()
      Object.keys(groups).forEach((normKey) => {
        const displayKey = labels[normKey] || normKey
        const collapsed = this.listState.collapsedGroups.has(displayKey) || this.listState.collapsedGroups.has(normKey)
        const $group = $('<div class="group"/>').attr("data-group-key", displayKey)
        const $header = $('<div class="group-header"/>')
          .append('<span class="toggle" aria-label="Toggle">' + (collapsed ? "▶" : "▼") + "</span>")
          .append('<span class="title">' + this.escapeHtml(displayKey) + "</span>")
          .append('<span class="count">(' + groups[normKey].length + ")</span>")
        const $list = $('<ul class="group-items"/>').toggle(!collapsed)
        groups[normKey].forEach((it) => {
          const $row = $('<li class="list-row" draggable="false"/>')
            .attr("data-id", it.id)
            .append('<span class="handle">⋮⋮</span>')
            .append('<span class="filename">' + this.escapeHtml(it.filename) + "</span>")
            .append('<span class="size">' + it.size.toUpperCase() + "</span>")
          $list.append($row)
        })
        $group.append($header).append($list)
        $wrap.append($group)
      })
      this.updateRowSelectionStyles()
    },

    initListSortables: function () {
      const $wrap = $("#gallery-group-list")
      // Sort whole groups
      $wrap.sortable({
        items: "> .group",
        handle: ".group-header",
        update: () => this.applyListOrderToHidden(),
      })
      // Sort items within and between groups
      $wrap
        .find(".group-items")
        .sortable({
          connectWith: ".group-items",
          items: "> .list-row",
          handle: ".handle",
          start: (e, ui) => {
            // if multi-selected and non-primary dragged, sync selection to include ui.item
            const id = ui.item.data("id")
            if (!this.listState.selectedIds.has(id)) {
              this.listState.selectedIds.clear()
              this.listState.selectedIds.add(id)
              this.updateRowSelectionStyles()
            }
            // Clone other selected rows and insert after the dragged item to move as a block
            ui.placeholder.height(ui.item.outerHeight())
            const $container = ui.item.parent()
            ui.item.data("multi-clones", [])
            this.listState.selectedIds.forEach((selId) => {
              if (selId === id) return
              const $row = $container.find('.list-row[data-id="' + selId + '"]')
              if ($row.length) {
                const $clone = $row.clone(true).addClass("moving-clone")
                ui.item.after($clone)
                ui.item.data("multi-clones").push({ orig: $row, clone: $clone })
                $row.hide()
              }
            })
          },
          stop: (e, ui) => {
            // Move originals to the final positions after the dragged item
            const clones = ui.item.data("multi-clones") || []
            clones.forEach((pair) => {
              pair.orig.insertAfter(ui.item)
              pair.clone.remove()
              pair.orig.show()
            })
            ui.item.removeData("multi-clones")
            // Apply order
            this.applyListOrderToHidden()
          },
        })
        .disableSelection()
    },

    updateRowSelectionStyles: function () {
      $(".list-row").removeClass("selected")
      this.listState.selectedIds.forEach((id) => {
        $('.list-row[data-id="' + id + '"]').addClass("selected")
      })
    },

    applyListOrderToHidden: function () {
      // Build new order from group lists, top-to-bottom
      const ordered = []
      $("#gallery-group-list .group").each(function () {
        $(this)
          .find(".group-items > .list-row")
          .each(function () {
            ordered.push($(this).data("id"))
          })
      })
      $("#gallery_images").val(ordered.join(","))
      // Reflect to grid so saving or switching view is consistent
      this.syncGridToHiddenOrder()
      // Clear active ordering button state (since manual list move)
      this.clearActiveOrderingButtons()
    },

    syncGridToHiddenOrder: function () {
      const idOrder = ($("#gallery_images").val() || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
      if (!idOrder.length) return
      const map = {}
      $("#gallery-preview .gallery-item").each(function () {
        const id = $(this).data("id") || $(this).data("image-id")
        if (id != null) map[id] = $(this)
      })
      const $preview = $("#gallery-preview")
      const fragments = []
      idOrder.forEach((id) => {
        const $el = map[id]
        if ($el) {
          fragments.push($el)
        }
      })
      // Append any leftovers not in hidden order (shouldn't happen but safe)
      $("#gallery-preview .gallery-item").each(function () {
        const id = $(this).data("id") || $(this).data("image-id")
        if (idOrder.indexOf(String(id)) === -1) {
          fragments.push($(this))
        }
      })
      $preview.append(fragments)
    },

    escapeHtml: function (str) {
      return String(str || "").replace(/[&<>"']/g, function (m) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
      })
    },

    updatePreviewSettings: function () {
      const columns = $("#columns").val() || 4
      const masonryEnabled = $("#masonry_enabled").is(":checked")

      // Add or update preview settings indicator
      let settingsIndicator = $(".gallery-preview-settings")
      if (settingsIndicator.length === 0) {
        settingsIndicator = $('<div class="gallery-preview-settings"></div>')
        $("#gallery-preview").before(settingsIndicator)
      }

      settingsIndicator.html("<strong>Preview:</strong> " + columns + " columns, " + (masonryEnabled ? "masonry enabled" : "equal height rows") + " <small>(matches frontend display)</small>")
    },

    copyShortcode: function (e) {
      e.preventDefault()
      const input = $(this).siblings(".shortcode-input")[0]
      input.select()
      input.setSelectionRange(0, 99999)

      try {
        document.execCommand("copy")
        const btn = $(this)
        const originalText = btn.text()
        btn.text("Copied!")
        setTimeout(() => btn.text(originalText), 1500)
      } catch (err) {
        console.error("Failed to copy: ", err)
      }
    },

    openMediaUploader: function (e) {
      e.preventDefault()

      if (typeof wp !== "undefined" && wp.media) {
        const mediaUploader = wp.media({
          title: "Select Media for Gallery",
          multiple: true,
          library: { type: ["image", "video"] },
        })

        mediaUploader.on("select", function () {
          const attachments = mediaUploader.state().get("selection").toJSON()
          galleryBuilder.addImages(attachments)
        })

        mediaUploader.open()
      }
    },

    addImages: function (attachments) {
      // Save current state before adding new images
      galleryBuilder.saveCurrentOrder()

      const template = wp.template("gallery-item")
      const preview = $("#gallery-preview")

      attachments.forEach(function (attachment) {
        // Skip if already in gallery
        if (preview.find('[data-id="' + attachment.id + '"]').length) {
          return
        }

        const isVideo = attachment.type === "video"
        let thumbUrl, thumbWidth, thumbHeight

        if (isVideo) {
          // Videos don't have image sizes — use the video URL directly
          thumbUrl = attachment.url
          thumbWidth = attachment.width || 640
          thumbHeight = attachment.height || 360
        } else {
          // Use medium size for better aspect ratio display
          const mediumSize = attachment.sizes && attachment.sizes.medium ? attachment.sizes.medium : attachment
          thumbUrl = mediumSize.url
          thumbWidth = mediumSize.width || attachment.width
          thumbHeight = mediumSize.height || attachment.height
        }

        const itemData = {
          id: attachment.id,
          thumb: thumbUrl,
          type: isVideo ? "video" : "image",
          width: thumbWidth,
          height: thumbHeight,
          filename: attachment.filename || attachment.name || attachment.title || "Unknown filename",
        }

        const itemHtml = template(itemData)
        const $item = $(itemHtml)

        // Add default size class (template already includes it, but ensure it's there)
        if (!$item.hasClass("size-regular")) {
          $item.addClass("size-regular")
        }

        preview.append($item)

        // Get current masonry size and set active button
        galleryBuilder.loadMasonrySize(attachment.id)

        // Load video settings if this is a video
        if (isVideo) {
          galleryBuilder.loadVideoSettings(attachment.id)
        }
      })

      // Clear any active ordering buttons since we added new images
      galleryBuilder.clearActiveOrderingButtons()
      this.updateImageOrder()
    },

    loadMasonrySize: function (imageId) {
      // Try to load new grid sizing format first
      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_get_grid_sizing",
          image_id: imageId,
          nonce: clearph_admin.nonce,
        },
        function (response) {
          if (response.success) {
            const item = $('[data-id="' + imageId + '"]')
            const columnSpan = response.data.column_span
            const rowSpan = response.data.row_span
            const format = response.data.format // 'grid' or 'legacy'

            // Update grid inputs
            item.find(".grid-column-input").val(columnSpan)
            item.find(".grid-row-input").val(rowSpan)

            // If using new grid format with inline styles
            if (format === "grid") {
              item.css({
                "grid-column": "span " + columnSpan,
                "grid-row": "span " + rowSpan,
              })
              // Deactivate preset buttons for custom sizing
              item.find(".size-btn").removeClass("active")
            } else if (format === "legacy") {
              // Legacy format - update size class and buttons
              const legacySize = response.data.legacy_size || "regular"
              item.removeClass("size-regular size-tall size-wide size-large size-xl")
              item.addClass("size-" + legacySize)
              item.find(".size-btn").removeClass("active")
              item.find('[data-size="' + legacySize + '"]').addClass("active")
            }
          }
        }
      )
    },

    removeItem: function (e) {
      e.preventDefault()
      galleryBuilder.saveCurrentOrder()
      $(this).closest(".gallery-item").remove()
      galleryBuilder.clearActiveOrderingButtons()
      galleryBuilder.updateImageOrder()
    },

    updateMasonrySize: function (e) {
      e.preventDefault()
      const btn = $(this)
      const item = btn.closest(".gallery-item")
      const imageId = item.data("id")
      const size = btn.data("size")

      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_update_masonry_size",
          image_id: imageId,
          size: size,
          nonce: clearph_admin.nonce,
        },
        function (response) {
          if (response.success) {
            // Update visual size class immediately
            item.removeClass("size-regular size-tall size-wide size-large size-xl")
            item.addClass("size-" + size)

            // Update button states
            item.find(".size-btn").removeClass("active")
            btn.addClass("active")

            // Also update grid inputs to match the preset
            galleryBuilder.syncGridInputsFromSize(item, size)
          }
        }
      )
    },

    applyGridSizing: function (e) {
      e.preventDefault()
      const btn = $(this)
      const item = btn.closest(".gallery-item")
      const imageId = item.data("id")
      const columnSpan = parseInt(item.find(".grid-column-input").val()) || 2
      const rowSpan = parseInt(item.find(".grid-row-input").val()) || 2

      // Validate ranges
      if (columnSpan < 1 || columnSpan > 12) {
        alert("Width must be between 1 and 12 micro-columns")
        return
      }
      if (rowSpan < 1 || rowSpan > 12) {
        alert("Height must be between 1 and 12 rows")
        return
      }

      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_update_grid_sizing",
          image_id: imageId,
          column_span: columnSpan,
          row_span: rowSpan,
          nonce: clearph_admin.nonce,
        },
        function (response) {
          if (response.success) {
            // Apply inline grid style for immediate visual feedback
            item.css({
              "grid-column": "span " + columnSpan,
              "grid-row": "span " + rowSpan,
            })

            // Deactivate preset size buttons (custom sizing)
            item.find(".size-btn").removeClass("active")

            // Visual feedback
            btn.text("✓").css("background", "#46b450")
            setTimeout(function () {
              btn.text("Apply").css("background", "#0073aa")
            }, 1000)
          } else {
            alert("Error saving grid sizing: " + (response.data || "Unknown error"))
          }
        }
      )
    },

    syncGridInputsFromSize: function (item, size) {
      // Map preset sizes to micro-column/row values
      const sizeMap = {
        regular: { column: 2, row: 2 },
        tall: { column: 2, row: 4 },
        wide: { column: 4, row: 2 },
        large: { column: 4, row: 4 },
        xl: { column: 6, row: 6 },
      }

      if (sizeMap[size]) {
        item.find(".grid-column-input").val(sizeMap[size].column)
        item.find(".grid-row-input").val(sizeMap[size].row)
      }
    },

    clearGallery: function (e) {
      e.preventDefault()
      if (confirm("Remove all images from this gallery?")) {
        galleryBuilder.saveCurrentOrder()
        $("#gallery-preview").empty()
        galleryBuilder.clearActiveOrderingButtons()
        galleryBuilder.updateImageOrder()
      }
    },

    updateImageOrder: function () {
      const imageIds = []
      $("#gallery-preview .gallery-item").each(function () {
        imageIds.push($(this).data("id"))
      })
      $("#gallery_images").val(imageIds.join(","))
    },

    saveCurrentOrder: function () {
      const currentOrder = []
      $("#gallery-preview .gallery-item").each(function () {
        currentOrder.push($(this).clone(true))
      })
      this.orderHistory.push(currentOrder)

      // Keep only last 10 states to prevent memory issues
      if (this.orderHistory.length > 10) {
        this.orderHistory.shift()
      }

      // Enable undo button if we have history
      $("#undo-order").prop("disabled", this.orderHistory.length <= 1)
    },

    clearActiveOrderingButtons: function () {
      $(".ordering-btn").removeClass("active")
      this.currentOrderType = null
    },

    setActiveOrderingButton: function (buttonId) {
      this.clearActiveOrderingButtons()
      $("#" + buttonId).addClass("active")
      this.currentOrderType = buttonId
    },

    reverseOrder: function (e) {
      e.preventDefault()
      galleryBuilder.saveCurrentOrder()

      const preview = $("#gallery-preview")
      const items = preview.children(".gallery-item").get().reverse()

      preview.empty()
      $.each(items, function (index, item) {
        preview.append(item)
      })

      galleryBuilder.setActiveOrderingButton("reverse-order")
      galleryBuilder.updateImageOrder()
    },

    randomizeOrder: function (e) {
      e.preventDefault()
      galleryBuilder.saveCurrentOrder()

      const preview = $("#gallery-preview")
      const items = preview.children(".gallery-item").get()

      // Fisher-Yates shuffle algorithm
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[items[i], items[j]] = [items[j], items[i]]
      }

      preview.empty()
      $.each(items, function (index, item) {
        preview.append(item)
      })

      galleryBuilder.setActiveOrderingButton("randomize-order")
      galleryBuilder.updateImageOrder()
    },

    sortByFilename: function (e) {
      e.preventDefault()
      const button = $(this)
      const direction = button.data("direction")

      galleryBuilder.saveCurrentOrder()

      const preview = $("#gallery-preview")
      const items = preview.children(".gallery-item").get()

      items.sort(function (a, b) {
        const filenameA = $(a).find(".image-filename").text().toLowerCase()
        const filenameB = $(b).find(".image-filename").text().toLowerCase()

        if (direction === "asc") {
          return filenameA.localeCompare(filenameB)
        } else {
          return filenameB.localeCompare(filenameA)
        }
      })

      preview.empty()
      $.each(items, function (index, item) {
        preview.append(item)
      })

      galleryBuilder.setActiveOrderingButton(button.attr("id"))
      galleryBuilder.updateImageOrder()
    },

    undoOrder: function (e) {
      e.preventDefault()

      if (galleryBuilder.orderHistory.length <= 1) {
        return
      }

      // Remove current state
      galleryBuilder.orderHistory.pop()

      // Get previous state
      const previousOrder = galleryBuilder.orderHistory[galleryBuilder.orderHistory.length - 1]

      if (previousOrder && previousOrder.length > 0) {
        const preview = $("#gallery-preview")
        preview.empty()

        $.each(previousOrder, function (index, item) {
          preview.append(item.clone(true))
        })

        galleryBuilder.clearActiveOrderingButtons()
        galleryBuilder.updateImageOrder()
      }

      // Disable undo if no more history
      $("#undo-order").prop("disabled", galleryBuilder.orderHistory.length <= 1)
    },

    // ===== Category Management =====
    populateCategoryDropdowns: function () {
      // Get categories from the filter_categories setting
      const categoriesStr = $("#filter_categories").val() || ""
      const categories = categoriesStr.split(",").map((cat) => cat.trim()).filter(Boolean)

      // Populate all category dropdowns
      $(".image-category-select").each(function () {
        const $select = $(this)
        const currentValue = $select.val()

        // Keep "No Category" option and add all categories
        $select.find("option:not(:first)").remove()
        categories.forEach(function (category) {
          $select.append($('<option></option>').val(category).text(category))
        })

        // Restore previous value if it exists
        if (currentValue && categories.includes(currentValue)) {
          $select.val(currentValue)
        }
      })
    },

    loadImageCategories: function () {
      // Get the post ID
      const postId = $("#post_ID").val()
      if (!postId) return

      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_get_image_categories",
          post_id: postId,
          nonce: clearph_admin.nonce,
        },
        function (response) {
          if (response.success && response.data) {
            // Set category for each image
            Object.keys(response.data).forEach(function (imageId) {
              const category = response.data[imageId]
              const $item = $('[data-id="' + imageId + '"]')
              if ($item.length) {
                $item.find(".image-category-select").val(category)
              }
            })
          }
        }
      )
    },

    // ===== Video Settings =====
    loadExistingVideoSettings: function () {
      $('#gallery-preview .gallery-item[data-type="video"]').each(function () {
        const imageId = $(this).data("id")
        if (imageId) {
          galleryBuilder.loadVideoSettings(imageId)
        }
      })
    },

    loadVideoSettings: function (imageId) {
      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_get_video_settings",
          image_id: imageId,
          nonce: clearph_admin.nonce,
        },
        function (response) {
          if (response.success) {
            const item = $('[data-id="' + imageId + '"]')
            item.find(".video-autoplay-select").val(response.data.autoplay)
            item.find(".video-badge-select").val(response.data.show_badge)
          }
        }
      )
    },

    bindVideoSettings: function () {
      $(document).on("change", ".video-autoplay-select, .video-badge-select", function () {
        const item = $(this).closest(".gallery-item")
        const imageId = item.data("id")
        const autoplay = item.find(".video-autoplay-select").val()
        const showBadge = item.find(".video-badge-select").val()

        $.post(
          clearph_admin.ajax_url,
          {
            action: "clearph_update_video_settings",
            image_id: imageId,
            autoplay: autoplay,
            show_badge: showBadge,
            nonce: clearph_admin.nonce,
          },
          function (response) {
            if (!response.success) {
              console.error("Failed to save video settings")
            }
          }
        )
      })
    },

    bindCategorySave: function () {
      // On post save/update, serialize category selections
      $("#post").on("submit", function () {
        const categories = {}
        $(".gallery-item").each(function () {
          const imageId = $(this).data("id")
          const category = $(this).find(".image-category-select").val()
          if (imageId && category) {
            categories[imageId] = category
          }
        })
        // Serialize as query string
        const categoryStr = $.param(categories)
        $("#image_categories").val(categoryStr)
      })

      // Also repopulate dropdowns when filter_categories changes
      $("#filter_categories").on("blur change", function () {
        galleryBuilder.populateCategoryDropdowns()
      })
    },
  }

  galleryBuilder.init()
})
