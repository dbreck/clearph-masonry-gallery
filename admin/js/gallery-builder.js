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
      this.loadExistingObjectPositions() // Load per-image object-position overrides
      this.bindObjectPosition() // Bind per-image object-position change handler
      this.bindOrderVisually() // Bind Order Visually modal
      this.bindLabelEditing() // Bind label editing in Layout panel + list view
      this.loadYouTubeSizingFromHidden() // Load YouTube sizing from hidden fields
      this.bindRowHeights() // Proportional row height in the admin previews
      this.bindResizeHandles() // Drag-to-resize corner handle on every item
    },

    initSortable: function () {
      $("#gallery-preview").sortable({
        items: ".gallery-item",
        // The resize handle drags a size, not the item
        cancel: "input,textarea,button,select,option,.clearph-resize-handle",
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
      $("#add-video").on("click", this.addVideo)
      $("#clear-gallery").on("click", this.clearGallery)
      $(document).on("click", ".remove-item", this.removeItem)
      $(document).on("click", ".size-btn", this.updateMasonrySize)
      $(document).on("click", ".grid-apply-btn", this.applyGridSizing)
      $(document).on("change", ".youtube-url-input", this.updateVideoUrl)
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

      // Bulk masonry buttons only make sense with masonry on
      $(".clearph-masonry-bulk-actions").toggle(masonryEnabled)

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
      // Sizing is now rendered server-side from _clearph_image_sizing gallery post meta.
      // No AJAX calls needed on initial page load — PHP sets input values and inline styles.
      // loadMasonrySize() is still used for newly added images via the media uploader.
    },

    // Helper: read/write gallery-scoped image sizing from/to hidden field
    getImageSizing: function () {
      var raw = JSON.parse($("#image_sizing").val() || "{}")
      return Array.isArray(raw) ? {} : raw
    },

    updateImageSizingField: function (imageId, colSpan, rowSpan) {
      var data = this.getImageSizing()
      data[String(imageId)] = { column_span: colSpan, row_span: rowSpan }
      $("#image_sizing").val(JSON.stringify(data))
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
          const labelData = this.getItemLabel(it.id)
          const $row = $('<li class="list-row" draggable="false"/>')
            .attr("data-id", it.id)
            .append('<span class="handle">⋮⋮</span>')
            .append('<span class="filename">' + this.escapeHtml(it.filename) + "</span>")
            .append('<input type="text" class="list-label-input" placeholder="Label..." value="' + this.escapeHtml(labelData.text || "") + '">')
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
      // YouTube items load from hidden field, not AJAX
      if (galleryBuilder.isExternalVideo(imageId)) return

      // Try to load grid sizing (checks gallery-scoped, then attachment meta, then legacy)
      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_get_grid_sizing",
          image_id: imageId,
          post_id: clearph_admin.post_id,
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
      const item = $(this).closest(".gallery-item")
      const itemId = String(item.data("id"))
      // Clean up YouTube data if it's a YouTube item
      if (galleryBuilder.isExternalVideo(itemId)) {
        galleryBuilder.removeYouTubeData(itemId)
      }
      item.remove()
      galleryBuilder.clearActiveOrderingButtons()
      galleryBuilder.updateImageOrder()
    },

    updateMasonrySize: function (e) {
      e.preventDefault()
      const btn = $(this)
      const item = btn.closest(".gallery-item")
      const imageId = String(item.data("id"))
      const size = btn.data("size")

      // YouTube items: save to hidden field, no AJAX
      if (galleryBuilder.isExternalVideo(imageId)) {
        item.removeClass("size-regular size-tall size-wide size-large size-xl")
        item.addClass("size-" + size)
        item.find(".size-btn").removeClass("active")
        btn.addClass("active")
        item.css({ "grid-column": "", "grid-row": "" }) // Clear inline styles so CSS class takes over
        galleryBuilder.syncGridInputsFromSize(item, size)
        galleryBuilder.updateYouTubeSizing(imageId, {
          masonry_size: size,
          column_span: parseInt(item.find(".grid-column-input").val()) || 2,
          row_span: parseInt(item.find(".grid-row-input").val()) || 2,
        })
        return
      }

      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_update_masonry_size",
          image_id: imageId,
          post_id: clearph_admin.post_id,
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

            // Sync hidden field
            var colSpan = parseInt(item.find(".grid-column-input").val()) || 2
            var rowSpan = parseInt(item.find(".grid-row-input").val()) || 2
            galleryBuilder.updateImageSizingField(imageId, colSpan, rowSpan)
          }
        }
      )
    },

    applyGridSizing: function (e) {
      e.preventDefault()
      const btn = $(this)
      const item = btn.closest(".gallery-item")
      const imageId = String(item.data("id"))
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

      // YouTube items: save to hidden field, no AJAX
      if (galleryBuilder.isExternalVideo(imageId)) {
        item.css({
          "grid-column": "span " + columnSpan,
          "grid-row": "span " + rowSpan,
        })
        item.find(".size-btn").removeClass("active")
        galleryBuilder.updateYouTubeSizing(imageId, {
          column_span: columnSpan,
          row_span: rowSpan,
          masonry_size: "custom",
        })
        btn.text("\u2713").css("background", "#46b450")
        setTimeout(function () {
          btn.text("Apply").css("background", "#0073aa")
        }, 1000)
        return
      }

      $.post(
        clearph_admin.ajax_url,
        {
          action: "clearph_update_grid_sizing",
          image_id: imageId,
          post_id: clearph_admin.post_id,
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

            // Sync hidden field
            galleryBuilder.updateImageSizingField(imageId, columnSpan, rowSpan)

            // Visual feedback
            btn.text("\u2713").css("background", "#46b450")
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
      if (confirm("Remove all items from this gallery?")) {
        galleryBuilder.saveCurrentOrder()
        $("#gallery-preview").empty()
        // Clear YouTube hidden fields
        $("#youtube_items").val("{}")
        $("#youtube_sizing").val("{}")
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

    // ===== Object Position (per-image) =====
    loadExistingObjectPositions: function () {
      $('#gallery-preview .gallery-item').each(function () {
        const $item = $(this)
        const imageId = $item.data("id")
        const type = $item.data("type")
        // Only images and videos have this control (not YouTube items)
        if (!imageId || (type !== "image" && type !== "video")) return
        if (typeof imageId === "string" && galleryBuilder.isExternalVideo(imageId)) return

        $.post(
          clearph_admin.ajax_url,
          {
            action: "clearph_get_object_position",
            image_id: imageId,
            nonce: clearph_admin.nonce,
          },
          function (response) {
            if (response.success) {
              $item.find(".image-position-select").val(response.data.position || "")
            }
          }
        )
      })
    },

    bindObjectPosition: function () {
      $(document).on("change", ".image-position-select", function () {
        const $item = $(this).closest(".gallery-item")
        const imageId = $item.data("id")
        const position = $(this).val()

        if (!imageId || (typeof imageId === "string" && galleryBuilder.isExternalVideo(imageId))) return

        $.post(
          clearph_admin.ajax_url,
          {
            action: "clearph_update_object_position",
            image_id: imageId,
            position: position,
            nonce: clearph_admin.nonce,
          },
          function (response) {
            if (!response.success) {
              console.error("Failed to save image position")
            }
          }
        )
      })
    },

    // ===== Order Visually / Layout Modal =====
    orderModalMode: "order",
    orderModalSelectedId: null,
    orderModalFilter: "*",

    bindOrderVisually: function () {
      $(document).on("click", "#order-visually", (e) => {
        e.preventDefault()
        this.openOrderModal()
      })
      $(document).on("click", "#clearph-order-modal-cancel, .clearph-order-modal__backdrop", (e) => {
        e.preventDefault()
        this.closeOrderModal()
      })
      $(document).on("click", "#clearph-order-modal-save", (e) => {
        e.preventDefault()
        this.saveOrderModal()
      })
      $(document).on("keydown", (e) => {
        if (e.key === "Escape" && $("#clearph-order-modal").is(":visible")) {
          this.closeOrderModal()
        }
      })
      $(document).on("input", "#clearph-order-modal-size", (e) => {
        const size = parseInt($(e.currentTarget).val(), 10) || 110
        document.documentElement.style.setProperty("--clearph-order-tile", size + "px")
        // In layout mode, also scale row height proportionally (tile/2 feels right)
        document.documentElement.style.setProperty("--clearph-layout-row-height", Math.round(size / 2) + "px")
      })

      // Layout container width slider (layout mode only)
      $(document).on("input", "#clearph-layout-width", (e) => {
        const pct = parseInt($(e.currentTarget).val(), 10) || 85
        document.documentElement.style.setProperty("--clearph-layout-width", pct + "%")
        $("#clearph-layout-width-value").text(pct + "%")
      })

      // Bulk layout buttons (main builder bar + Layout mode toolbar)
      $(document).on("click", ".clearph-auto-masonry", (e) => {
        e.preventDefault()
        this.ratioLayout("auto")
      })
      $(document).on("click", ".clearph-shuffle-masonry", (e) => {
        e.preventDefault()
        this.ratioLayout("shuffle")
      })

      // Mode switch tabs
      $(document).on("click", ".clearph-mode-btn", (e) => {
        e.preventDefault()
        const mode = $(e.currentTarget).data("mode")
        this.switchModalMode(mode)
      })

      // Order mode: category filter button
      $(document).on("click", ".clearph-order-filter-btn", (e) => {
        e.preventDefault()
        const value = $(e.currentTarget).attr("data-filter")
        this.applyOrderModalFilter(value)
      })

      // Order mode: remove tile (also removes source item so delete persists on save)
      $(document).on("mousedown", ".clearph-order-tile__remove", (e) => {
        // Prevent sortable from picking up the drag when clicking the remove button
        e.stopPropagation()
      })
      $(document).on("click", ".clearph-order-tile__remove", (e) => {
        e.preventDefault()
        e.stopPropagation()
        const $tile = $(e.currentTarget).closest(".clearph-order-tile")
        const id = String($tile.attr("data-id") || "")
        if (!id) return

        this.saveCurrentOrder()

        // Clean up YouTube-specific data if applicable
        if (galleryBuilder.isExternalVideo(id)) {
          this.removeYouTubeData(id)
        }

        // Remove from source grid so Save and mode switches reflect the deletion
        this.getSourceItem(id).remove()

        // Remove from modal grid + refresh
        $tile.remove()
        this.clearActiveOrderingButtons()
        this.updateImageOrder()
        this.refreshOrderModalIndexes()
        const $grid = $("#clearph-order-modal-grid")
        if ($grid.data("ui-sortable")) $grid.sortable("refresh")
        this.renderOrderFilterBar()

        // If the deleted item was currently selected in the panel, clear it
        if (this.orderModalSelectedId === id) {
          this.orderModalSelectedId = null
          this.showLayoutPanelEmpty()
        }
      })

      // Layout tile click = select
      $(document).on("click", ".clearph-layout-tile", (e) => {
        const id = $(e.currentTarget).attr("data-id")
        this.selectLayoutTile(id)
      })

      // Order tile click = select (ignore synthetic click that fires after a drag)
      $(document).on("click", ".clearph-order-tile", (e) => {
        if (this.orderDragActive) return
        if ($(e.target).closest(".clearph-order-tile__remove").length) return
        const id = $(e.currentTarget).attr("data-id")
        if (id) this.selectLayoutTile(id)
      })

      // Layout panel: preset size buttons
      $(document).on("click", ".layout-size-btn", (e) => {
        e.preventDefault()
        const size = $(e.currentTarget).data("size")
        const id = this.orderModalSelectedId
        if (!id) return
        const $source = this.getSourceItem(id)
        if (!$source.length) return
        // Trigger the existing size-btn handler on the source item
        $source.find('.size-btn[data-size="' + size + '"]').trigger("click")
        $(".layout-size-btn").removeClass("is-active")
        $(e.currentTarget).addClass("is-active")
        // Wait a tick for AJAX + DOM sync, then refresh tile + inputs
        setTimeout(() => {
          this.refreshLayoutTile(id)
          this.syncPanelInputsFromSource(id)
        }, 250)
      })

      // Layout panel: Apply Width/Height
      $(document).on("click", ".layout-grid-apply-btn", (e) => {
        e.preventDefault()
        const id = this.orderModalSelectedId
        if (!id) return
        const col = parseInt($(".layout-grid-column-input").val(), 10) || 2
        const row = parseInt($(".layout-grid-row-input").val(), 10) || 2
        if (col < 1 || col > 12 || row < 1 || row > 12) {
          alert("Width and Height must be between 1 and 12")
          return
        }
        const $source = this.getSourceItem(id)
        if (!$source.length) return
        $source.find(".grid-column-input").val(col)
        $source.find(".grid-row-input").val(row)
        $source.find(".grid-apply-btn").trigger("click")
        setTimeout(() => this.refreshLayoutTile(id), 250)
      })

      // Layout panel: Image Position change
      $(document).on("change", ".layout-position-select", (e) => {
        const val = $(e.currentTarget).val()
        const id = this.orderModalSelectedId
        if (!id) return
        const $source = this.getSourceItem(id)
        if (!$source.length) return
        $source.find(".image-position-select").val(val).trigger("change")
      })

      // Layout panel: Category change
      $(document).on("change", ".layout-category-select", (e) => {
        const val = $(e.currentTarget).val()
        const id = this.orderModalSelectedId
        if (!id) return
        const $source = this.getSourceItem(id)
        if (!$source.length) return
        $source.find(".image-category-select").val(val).trigger("change")
      })

      // Layout panel: Video settings
      $(document).on("change", ".layout-video-autoplay-select, .layout-video-badge-select", (e) => {
        const id = this.orderModalSelectedId
        if (!id) return
        const $source = this.getSourceItem(id)
        if (!$source.length) return
        $source.find(".video-autoplay-select").val($(".layout-video-autoplay-select").val())
        $source.find(".video-badge-select").val($(".layout-video-badge-select").val())
        // Trigger change to fire the existing handler
        $source.find(".video-autoplay-select").trigger("change")
      })

      // Layout panel: YouTube URL change
      $(document).on("change", ".layout-youtube-url-input", (e) => {
        const val = $(e.currentTarget).val()
        const id = this.orderModalSelectedId
        if (!id) return
        const $source = this.getSourceItem(id)
        if (!$source.length) return
        $source.find(".youtube-url-input").val(val).trigger("change")
      })
    },

    getSourceItem: function (id) {
      // Use attribute selector to handle both int IDs and yt_ strings
      return $('#gallery-preview .gallery-item[data-id="' + id + '"]')
    },

    switchModalMode: function (mode) {
      if (mode === this.orderModalMode) return

      // When leaving Order mode, commit any pending order changes to source
      if (this.orderModalMode === "order" && mode === "layout") {
        this.commitOrderFromModal()
      }

      this.orderModalMode = mode
      $("#clearph-order-modal").attr("data-mode", mode)
      $(".clearph-mode-btn").removeClass("is-active").attr("aria-selected", "false")
      $('.clearph-mode-btn[data-mode="' + mode + '"]').addClass("is-active").attr("aria-selected", "true")

      if (mode === "order") {
        $(".clearph-order-modal__body--order").show()
        $(".clearph-order-modal__body--layout").hide()
        $("[data-hint-order]").show()
        $("[data-hint-layout]").hide()
        $("[data-tool-layout-only]").hide()
        $("#clearph-order-modal-save").show().text("Save & Close")
        $("#clearph-order-modal-cancel").text("Cancel")
        this.renderOrderView()
      } else {
        $(".clearph-order-modal__body--order").hide()
        $(".clearph-order-modal__body--layout").css("display", "flex")
        $("[data-hint-order]").hide()
        $("[data-hint-layout]").show()
        $("[data-tool-layout-only]").css("display", "inline-flex")
        // In layout mode all edits are live-saved, so hide Save button (keep Cancel as "Close")
        $("#clearph-order-modal-save").hide()
        $("#clearph-order-modal-cancel").text("Close")
        this.renderLayoutView()
      }
    },

    commitOrderFromModal: function () {
      // If user reordered tiles but didn't hit Save, push that order to the grid DOM
      // so the layout view reflects current drag state
      const newOrder = []
      $("#clearph-order-modal-grid > .clearph-order-tile").each(function () {
        const id = $(this).attr("data-id")
        if (id) newOrder.push(id)
      })
      if (!newOrder.length) return
      $("#gallery_images").val(newOrder.join(","))
      this.syncGridToHiddenOrder()
    },

    renderOrderView: function () {
      const $grid = $("#clearph-order-modal-grid")
      $grid.empty()

      $("#gallery-preview .gallery-item").each(function (index) {
        const $item = $(this)
        const id = $item.data("id")
        const type = $item.data("type") || "image"
        const category = $item.find(".image-category-select").val() || ""

        const $tile = $('<div class="clearph-order-tile"></div>')
          .attr("data-id", id)
          .attr("data-type", type)
          .attr("data-category", category)

        const $img = $item.find(".image-container img").first()
        const $video = $item.find(".image-container video").first()

        if ($img.length) {
          $tile.append($('<img>').attr("src", $img.attr("src")).attr("alt", ""))
        } else if ($video.length) {
          const poster = $video.attr("poster")
          if (poster) {
            $tile.append($('<img>').attr("src", poster).attr("alt", ""))
          } else {
            $tile.append($('<video muted playsinline preload="metadata"></video>').attr("src", $video.attr("src")))
          }
        }

        $tile.append('<span class="clearph-order-tile__index">' + (index + 1) + "</span>")
        $tile.append('<button type="button" class="clearph-order-tile__remove" aria-label="Remove item" title="Remove item">&times;</button>')

        if (type === "video") {
          $tile.append('<span class="clearph-order-tile__badge clearph-order-tile__badge--video">Video</span>')
        } else if (galleryBuilder.isExternalType(type)) {
          $tile.append('<span class="clearph-order-tile__badge clearph-order-tile__badge--youtube">' + (type === "vimeo" ? "Vimeo" : "YT") + "</span>")
        }

        $grid.append($tile)
      })

      // (Re)initialize sortable
      if ($grid.data("ui-sortable")) {
        $grid.sortable("destroy")
      }
      $grid.sortable({
        items: "> .clearph-order-tile:visible",
        tolerance: "pointer",
        forcePlaceholderSize: true,
        placeholder: "clearph-order-modal__placeholder",
        start: () => { this.orderDragActive = true },
        stop: () => {
          // Keep the flag set briefly so the synthetic click after drop doesn't select the tile
          setTimeout(() => { this.orderDragActive = false }, 50)
        },
        update: () => this.refreshOrderModalIndexes(),
      })

      // Build the category filter bar and re-apply current filter
      this.renderOrderFilterBar()
      this.applyOrderModalFilter(this.orderModalFilter || "*")

      // Populate panel category options and restore selection if the selected id still exists
      this.populateLayoutCategoryOptions()
      if (this.orderModalSelectedId && $('.clearph-order-tile[data-id="' + this.orderModalSelectedId + '"]').length) {
        this.selectLayoutTile(this.orderModalSelectedId)
      } else {
        this.orderModalSelectedId = null
        this.showLayoutPanelEmpty()
      }
    },

    renderOrderFilterBar: function () {
      const $bar = $("#clearph-order-filter-bar")
      const $buttons = $("#clearph-order-filter-buttons").empty()

      const categoriesStr = $("#filter_categories").val() || ""
      const configured = categoriesStr.split(",").map((c) => c.trim()).filter(Boolean)

      // Detect which categories are actually used by tiles (so we can show an Uncategorized bucket when relevant)
      let hasUncategorized = false
      const usedSet = new Set()
      $("#clearph-order-modal-grid > .clearph-order-tile").each(function () {
        const cat = $(this).attr("data-category") || ""
        if (cat) usedSet.add(cat)
        else hasUncategorized = true
      })

      // If there are no categories configured AND nothing is uncategorized, hide the bar entirely
      if (!configured.length && !usedSet.size) {
        $bar.hide()
        return
      }
      $bar.show()

      const current = this.orderModalFilter || "*"
      const addBtn = (value, label) => {
        const $b = $('<button type="button" class="clearph-order-filter-btn"></button>')
          .attr("data-filter", value)
          .text(label)
        if (value === current) $b.addClass("is-active")
        $buttons.append($b)
      }

      addBtn("*", "All")
      configured.forEach((cat) => addBtn(cat, cat))
      // Include any categories present on tiles but missing from configured list (e.g. after a rename)
      usedSet.forEach((cat) => {
        if (!configured.includes(cat)) addBtn(cat, cat)
      })
      if (hasUncategorized) addBtn("__none__", "Uncategorized")
    },

    applyOrderModalFilter: function (value) {
      this.orderModalFilter = value || "*"

      $(".clearph-order-filter-btn")
        .removeClass("is-active")
        .filter('[data-filter="' + this.orderModalFilter.replace(/"/g, '\\"') + '"]')
        .addClass("is-active")

      const $tiles = $("#clearph-order-modal-grid > .clearph-order-tile")
      if (this.orderModalFilter === "*") {
        $tiles.show()
      } else if (this.orderModalFilter === "__none__") {
        $tiles.each(function () {
          const cat = $(this).attr("data-category") || ""
          $(this).toggle(cat === "")
        })
      } else {
        $tiles.each(function () {
          const cat = $(this).attr("data-category") || ""
          $(this).toggle(cat === value)
        })
      }

      // Sortable uses `:visible` items; refreshing tells it to re-scan
      const $grid = $("#clearph-order-modal-grid")
      if ($grid.data("ui-sortable")) $grid.sortable("refresh")

      // Global indexes stay correct after show/hide (they reflect DOM order). Just recompute to be safe.
      this.refreshOrderModalIndexes()
    },

    renderLayoutView: function () {
      const $grid = $("#clearph-layout-grid")
      $grid.empty()

      const columns = parseInt($("#columns").val(), 10) || 4
      const microCols = columns * 2
      document.documentElement.style.setProperty("--clearph-layout-micro-cols", microCols)
      this.syncRowHeights()

      $("#gallery-preview .gallery-item").each(function () {
        const $source = $(this)
        const id = $source.data("id")
        const type = $source.data("type") || "image"

        // Read current spans — prefer input values (set by loadMasonrySize), fall back to class-based defaults
        let colSpan = parseInt($source.find(".grid-column-input").val(), 10)
        let rowSpan = parseInt($source.find(".grid-row-input").val(), 10)
        if (!colSpan || !rowSpan) {
          const fallback = galleryBuilder.classToSpan($source)
          colSpan = colSpan || fallback.col
          rowSpan = rowSpan || fallback.row
        }

        const $tile = $('<div class="clearph-layout-tile"></div>')
          .attr("data-id", id)
          .attr("data-type", type)
          .css({
            "grid-column": "span " + colSpan,
            "grid-row": "span " + rowSpan,
          })

        const $img = $source.find(".image-container img").first()
        const $video = $source.find(".image-container video").first()
        if ($img.length) {
          $tile.append($('<img>').attr("src", $img.attr("src")).attr("alt", ""))
        } else if ($video.length) {
          const poster = $video.attr("poster")
          if (poster) {
            $tile.append($('<img>').attr("src", poster).attr("alt", ""))
          } else {
            $tile.append($('<video muted playsinline preload="metadata"></video>').attr("src", $video.attr("src")))
          }
        }

        if (type === "video") {
          $tile.append('<span class="clearph-layout-tile__badge clearph-layout-tile__badge--video">Video</span>')
        } else if (galleryBuilder.isExternalType(type)) {
          $tile.append('<span class="clearph-layout-tile__badge clearph-layout-tile__badge--youtube">' + (type === "vimeo" ? "Vimeo" : "YT") + "</span>")
        }

        $grid.append($tile)
      })

      // Populate category dropdown in the panel from the main settings
      this.populateLayoutCategoryOptions()

      // Restore selection if previously selected
      if (this.orderModalSelectedId) {
        const $selTile = $('.clearph-layout-tile[data-id="' + this.orderModalSelectedId + '"]')
        if ($selTile.length) {
          this.selectLayoutTile(this.orderModalSelectedId)
        } else {
          this.orderModalSelectedId = null
          this.showLayoutPanelEmpty()
        }
      } else {
        this.showLayoutPanelEmpty()
      }
    },

    classToSpan: function ($item) {
      const cls = ($item.attr("class") || "").match(/size-(regular|tall|wide|large|xl)/)
      const map = {
        regular: { col: 2, row: 2 },
        tall: { col: 2, row: 4 },
        wide: { col: 4, row: 2 },
        large: { col: 4, row: 4 },
        xl: { col: 6, row: 6 },
      }
      return map[cls ? cls[1] : "regular"]
    },

    refreshLayoutTile: function (id) {
      const $source = this.getSourceItem(id)
      if (!$source.length) return
      let colSpan = parseInt($source.find(".grid-column-input").val(), 10)
      let rowSpan = parseInt($source.find(".grid-row-input").val(), 10)
      if (!colSpan || !rowSpan) {
        const fb = this.classToSpan($source)
        colSpan = colSpan || fb.col
        rowSpan = rowSpan || fb.row
      }
      $('.clearph-layout-tile[data-id="' + id + '"]').css({
        "grid-column": "span " + colSpan,
        "grid-row": "span " + rowSpan,
      })
    },

    selectLayoutTile: function (id) {
      $(".clearph-layout-tile, .clearph-order-tile").removeClass("is-selected")
      $('.clearph-layout-tile[data-id="' + id + '"], .clearph-order-tile[data-id="' + id + '"]').addClass("is-selected")
      this.orderModalSelectedId = id
      this.populateLayoutPanel(id)
    },

    showLayoutPanelEmpty: function () {
      $(".clearph-layout-panel__empty").show()
      $(".clearph-layout-panel__content").hide()
    },

    populateLayoutPanel: function (id) {
      const $source = this.getSourceItem(id)
      if (!$source.length) {
        this.showLayoutPanelEmpty()
        return
      }

      $(".clearph-layout-panel__empty").hide()
      $(".clearph-layout-panel__content").show()

      const type = $source.data("type") || "image"

      // Preview
      const $preview = $(".clearph-layout-panel__preview").empty()
      const $srcImg = $source.find(".image-container img").first()
      const $srcVideo = $source.find(".image-container video").first()
      if ($srcImg.length) {
        $preview.append($('<img>').attr("src", $srcImg.attr("src")))
      } else if ($srcVideo.length) {
        const poster = $srcVideo.attr("poster")
        if (poster) {
          $preview.append($('<img>').attr("src", poster))
        } else {
          $preview.append($('<video muted playsinline preload="metadata"></video>').attr("src", $srcVideo.attr("src")))
        }
      }

      // Filename
      const filename = $source.attr("data-filename") || $source.find(".image-filename").text() || String(id)
      $(".clearph-layout-panel__filename").text(filename)

      // Sync panel inputs from source state
      this.syncPanelInputsFromSource(id)

      // Toggle section visibility by type
      $(".clearph-layout-panel__section--category").toggle(type === "image")
      $(".clearph-layout-panel__section--video").toggle(type === "video")
      $(".clearph-layout-panel__section--youtube").toggle(this.isExternalType(type))
    },

    syncPanelInputsFromSource: function (id) {
      const $source = this.getSourceItem(id)
      if (!$source.length) return

      // Preset size — active button
      const cls = ($source.attr("class") || "").match(/size-(regular|tall|wide|large|xl)/)
      const activeSize = cls ? cls[1] : "regular"
      $(".layout-size-btn").removeClass("is-active")
      $('.layout-size-btn[data-size="' + activeSize + '"]').addClass("is-active")

      // Width/Height
      $(".layout-grid-column-input").val($source.find(".grid-column-input").val() || 2)
      $(".layout-grid-row-input").val($source.find(".grid-row-input").val() || 2)

      // Image Position
      $(".layout-position-select").val($source.find(".image-position-select").val() || "")

      // Category
      $(".layout-category-select").val($source.find(".image-category-select").val() || "")

      // Video settings
      $(".layout-video-autoplay-select").val($source.find(".video-autoplay-select").val() || "hover")
      $(".layout-video-badge-select").val($source.find(".video-badge-select").val() || "yes")

      // YouTube URL
      $(".layout-youtube-url-input").val($source.find(".youtube-url-input").val() || "")

      // Image label (from gallery-level hidden JSON, not attachment meta)
      const labelData = this.getItemLabel(id)
      $(".layout-label-text").val(labelData.text || "")
      $(".layout-label-color").val(labelData.color || "")
      $(".layout-label-shadow").val(labelData.shadow != null ? String(labelData.shadow) : "")
    },

    populateLayoutCategoryOptions: function () {
      // Mirror options from any source item's category select (they all share the same options)
      const $panelSelect = $(".layout-category-select")
      const firstSource = $("#gallery-preview .gallery-item .image-category-select").first()
      if (!firstSource.length) return
      $panelSelect.empty()
      firstSource.find("option").each(function () {
        $panelSelect.append($(this).clone())
      })
    },

    // ===== Image Labels =====
    getImageLabels: function () {
      try {
        const raw = JSON.parse($("#image_labels").val() || "{}")
        return Array.isArray(raw) ? {} : raw
      } catch (e) {
        return {}
      }
    },

    setImageLabels: function (labels) {
      $("#image_labels").val(JSON.stringify(labels))
    },

    getItemLabel: function (id) {
      const labels = this.getImageLabels()
      return labels[String(id)] || { text: "", color: "", shadow: "" }
    },

    setItemLabel: function (id, data) {
      const labels = this.getImageLabels()
      if (!data.text) {
        delete labels[String(id)]
      } else {
        labels[String(id)] = {
          text: data.text || "",
          color: data.color || "",
          shadow: String(data.shadow != null ? data.shadow : ""),
        }
      }
      this.setImageLabels(labels)
    },

    bindLabelEditing: function () {
      // Layout panel: label text field (debounced save)
      let labelTimer = null
      $(document).on("input", ".layout-label-text", (e) => {
        clearTimeout(labelTimer)
        labelTimer = setTimeout(() => {
          const id = this.orderModalSelectedId
          if (!id) return
          const data = this.getItemLabel(id)
          data.text = $(e.currentTarget).val()
          this.setItemLabel(id, data)
        }, 300)
      })

      // Layout panel: color override
      $(document).on("change", ".layout-label-color", (e) => {
        const id = this.orderModalSelectedId
        if (!id) return
        const data = this.getItemLabel(id)
        data.color = $(e.currentTarget).val()
        this.setItemLabel(id, data)
      })

      // Layout panel: shadow override
      $(document).on("change", ".layout-label-shadow", (e) => {
        const id = this.orderModalSelectedId
        if (!id) return
        const data = this.getItemLabel(id)
        data.shadow = $(e.currentTarget).val()
        this.setItemLabel(id, data)
      })

      // List view: inline label input (debounced)
      let listLabelTimer = null
      $(document).on("input", ".list-label-input", function () {
        const $row = $(this).closest(".list-row")
        const id = $row.data("id")
        if (!id) return
        clearTimeout(listLabelTimer)
        listLabelTimer = setTimeout(() => {
          const data = galleryBuilder.getItemLabel(id)
          data.text = $(this).val()
          galleryBuilder.setItemLabel(id, data)
        }, 300)
      })
    },

    openOrderModal: function () {
      // Reset mode to Order every open
      this.orderModalMode = "order"
      this.orderModalSelectedId = null
      this.orderModalFilter = "*"
      $("#clearph-order-modal").attr("data-mode", "order")
      $(".clearph-mode-btn").removeClass("is-active").attr("aria-selected", "false")
      $('.clearph-mode-btn[data-mode="order"]').addClass("is-active").attr("aria-selected", "true")
      $(".clearph-order-modal__body--order").show()
      $(".clearph-order-modal__body--layout").hide()
      $("[data-hint-order]").show()
      $("[data-hint-layout]").hide()
      $("[data-tool-layout-only]").hide()
      $("#clearph-order-modal-save").show().text("Save & Close")
      $("#clearph-order-modal-cancel").text("Cancel")

      // Initialize tile size CSS var
      const initialSize = parseInt($("#clearph-order-modal-size").val(), 10) || 110
      document.documentElement.style.setProperty("--clearph-order-tile", initialSize + "px")
      document.documentElement.style.setProperty("--clearph-layout-row-height", Math.round(initialSize / 2) + "px")

      // Initialize layout container width CSS var
      const initialWidth = parseInt($("#clearph-layout-width").val(), 10) || 85
      document.documentElement.style.setProperty("--clearph-layout-width", initialWidth + "%")
      $("#clearph-layout-width-value").text(initialWidth + "%")

      // Build the order view from current grid state
      this.renderOrderView()

      $("#clearph-order-modal").show().attr("aria-hidden", "false")
    },

    refreshOrderModalIndexes: function () {
      $("#clearph-order-modal-grid > .clearph-order-tile").each(function (index) {
        $(this).find(".clearph-order-tile__index").text(index + 1)
      })
    },

    closeOrderModal: function () {
      $("#clearph-order-modal").hide().attr("aria-hidden", "true")
      const $grid = $("#clearph-order-modal-grid")
      if ($grid.data("ui-sortable")) {
        $grid.sortable("destroy")
      }
      $grid.empty()
      $("#clearph-layout-grid").empty()
      $("#clearph-order-filter-buttons").empty()
      $("#clearph-order-filter-bar").hide()
      this.orderModalSelectedId = null
      this.orderModalMode = "order"
      this.orderModalFilter = "*"
      $("#clearph-order-modal-cancel").text("Cancel")
      this.showLayoutPanelEmpty()
    },

    saveOrderModal: function () {
      // Save undo state before committing
      this.saveCurrentOrder()

      // Collect new order from the modal
      const newOrder = []
      $("#clearph-order-modal-grid > .clearph-order-tile").each(function () {
        const id = $(this).attr("data-id")
        if (id != null && id !== "") newOrder.push(id)
      })

      if (!newOrder.length) {
        this.closeOrderModal()
        return
      }

      // Write to hidden input
      $("#gallery_images").val(newOrder.join(","))

      // Re-order the grid DOM to match
      this.syncGridToHiddenOrder()

      // If list view was previously built, rebuild it from new grid order
      if (this.viewMode === "list") {
        this.buildListView()
      }

      // Clear any active sort button state (manual reorder)
      this.clearActiveOrderingButtons()

      this.closeOrderModal()
    },

    // ===== YouTube Management =====
    extractYouTubeId: function (url) {
      var patterns = [
        /(?:youtube\.com\/watch\?.*v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      ]
      for (var i = 0; i < patterns.length; i++) {
        var match = url.match(patterns[i])
        if (match) return match[1]
      }
      return null
    },

    isYouTubeShort: function (url) {
      return /youtube\.com\/shorts\//.test(url)
    },

    // External videos are "yt_<id>" (YouTube) or "vm_<id>" (Vimeo) items. Both
    // keep their data in the #youtube_items / #youtube_sizing hidden fields.
    isExternalVideo: function (id) {
      return /^(yt|vm)_/.test(String(id))
    },

    isExternalType: function (type) {
      return type === "youtube" || type === "vimeo"
    },

    extractVimeoVideo: function (url) {
      var m = String(url).match(/vimeo\.com\/(?:[^?#]*\/)?(\d+)(?:\/([a-f0-9]+))?(?:[\/?#]|$)/i)
      if (!m) return null
      var hash = m[2] || ""
      if (!hash) {
        var h = String(url).match(/[?&]h=([a-f0-9]+)/i)
        if (h) hash = h[1]
      }
      return { id: m[1], hash: hash.toLowerCase() }
    },

    /**
     * Turn a YouTube or Vimeo URL into an external-video record. Vimeo needs a
     * server round trip (oEmbed) for its thumbnail and real dimensions.
     * @returns {Promise} resolves { itemId, type, label, thumb, tall, meta }, rejects with a message
     */
    resolveVideoUrl: function (url) {
      var d = $.Deferred()
      var ytId = this.extractYouTubeId(url)
      if (ytId) {
        var isShort = this.isYouTubeShort(url)
        return d
          .resolve({
            itemId: "yt_" + ytId,
            type: "youtube",
            label: "YouTube: " + ytId,
            thumb: "https://img.youtube.com/vi/" + ytId + "/hqdefault.jpg",
            tall: isShort,
            meta: { video_id: ytId, url: url, is_short: isShort },
          })
          .promise()
      }

      if (!this.extractVimeoVideo(url)) {
        return d
          .reject(
            "Couldn't read a YouTube or Vimeo video from that URL. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/, vimeo.com/ID, vimeo.com/ID/HASH (unlisted), player.vimeo.com/video/ID"
          )
          .promise()
      }

      $.post(clearph_admin.ajax_url, { action: "clearph_vimeo_lookup", nonce: clearph_admin.nonce, url: url })
        .done(function (response) {
          if (!response.success) {
            d.reject(response.data || "Vimeo lookup failed.")
            return
          }
          var v = response.data
          d.resolve({
            itemId: "vm_" + v.video_id,
            type: "vimeo",
            label: "Vimeo: " + v.video_id,
            thumb: v.thumb,
            tall: v.height > v.width,
            meta: {
              provider: "vimeo",
              video_id: v.video_id,
              hash: v.hash,
              url: url,
              is_short: false,
              thumb: v.thumb,
              width: v.width,
              height: v.height,
              title: v.title,
            },
          })
        })
        .fail(function () {
          d.reject("Couldn't reach the server to look up that Vimeo video.")
        })
      return d.promise()
    },

    addVideo: function (e) {
      e.preventDefault()
      var url = prompt("Enter a YouTube or Vimeo video URL:")
      if (!url) return

      var $btn = $("#add-video").prop("disabled", true)
      galleryBuilder
        .resolveVideoUrl(url.trim())
        .done(function (video) {
          galleryBuilder.insertVideoItem(video)
        })
        .fail(function (message) {
          alert(message)
        })
        .always(function () {
          $btn.prop("disabled", false)
        })
    },

    insertVideoItem: function (video) {
      var preview = $("#gallery-preview")

      // Skip if already in gallery
      if (preview.find('[data-id="' + video.itemId + '"]').length) {
        alert("This video is already in the gallery.")
        return
      }

      galleryBuilder.saveCurrentOrder()

      var defaultSize = video.tall ? "tall" : "regular"
      var defaultSizing = video.tall ? { column: 2, row: 4 } : { column: 2, row: 2 }

      var template = wp.template("youtube-item")
      preview.append(
        template({
          yt_id: video.itemId,
          type: video.type,
          label: video.label,
          video_id: video.meta.video_id,
          url: video.meta.url,
          thumb: video.thumb,
          masonry_size: defaultSize,
          column_span: defaultSizing.column,
          row_span: defaultSizing.row,
        })
      )

      // Store video data in hidden fields
      galleryBuilder.updateYouTubeData(video.itemId, video.meta)
      galleryBuilder.updateYouTubeSizing(video.itemId, {
        column_span: defaultSizing.column,
        row_span: defaultSizing.row,
        masonry_size: defaultSize,
      })

      // Populate category dropdown for the new item
      galleryBuilder.populateCategoryDropdowns()

      galleryBuilder.clearActiveOrderingButtons()
      galleryBuilder.updateImageOrder()
    },

    getYouTubeItems: function () {
      var raw = JSON.parse($("#youtube_items").val() || "{}")
      return Array.isArray(raw) ? {} : raw
    },

    getYouTubeSizing: function () {
      var raw = JSON.parse($("#youtube_sizing").val() || "{}")
      return Array.isArray(raw) ? {} : raw
    },

    updateYouTubeData: function (ytId, data) {
      var items = this.getYouTubeItems()
      items[ytId] = data
      $("#youtube_items").val(JSON.stringify(items))
    },

    updateYouTubeSizing: function (ytId, sizing) {
      var data = this.getYouTubeSizing()
      data[ytId] = sizing
      $("#youtube_sizing").val(JSON.stringify(data))
    },

    removeYouTubeData: function (ytId) {
      var items = this.getYouTubeItems()
      delete items[ytId]
      $("#youtube_items").val(JSON.stringify(items))

      var sizing = this.getYouTubeSizing()
      delete sizing[ytId]
      $("#youtube_sizing").val(JSON.stringify(sizing))
    },

    loadYouTubeSizingFromHidden: function () {
      var sizing = this.getYouTubeSizing()
      Object.keys(sizing).forEach(function (ytId) {
        var item = $('[data-id="' + ytId + '"]')
        if (!item.length) return
        var s = sizing[ytId]
        if (s.column_span && s.row_span) {
          item.find(".grid-column-input").val(s.column_span)
          item.find(".grid-row-input").val(s.row_span)
        }
      })
    },

    updateVideoUrl: function () {
      var $input = $(this)
      var item = $input.closest(".gallery-item")
      var oldId = String(item.data("id"))
      var oldUrl = (galleryBuilder.getYouTubeItems()[oldId] || {}).url || ""
      var newUrl = $input.val().trim()

      if (!newUrl || newUrl === oldUrl) return

      galleryBuilder
        .resolveVideoUrl(newUrl)
        .done(function (video) {
          var newId = video.itemId
          if (newId !== oldId && $('#gallery-preview .gallery-item[data-id="' + newId + '"]').length) {
            alert("That video is already in the gallery.")
            $input.val(oldUrl)
            return
          }

          item.find(".image-container img").attr("src", video.thumb)
          item.find(".image-filename").text(video.label)
          item.attr("data-type", video.type).data("type", video.type)

          // If the video changed, move its sizing to the new ID
          if (newId !== oldId) {
            var sizeClass = (item.attr("class") || "").match(/size-(regular|tall|wide|large|xl)/)
            var sizing = {
              column_span: parseInt(item.find(".grid-column-input").val()) || 2,
              row_span: parseInt(item.find(".grid-row-input").val()) || 2,
              masonry_size: sizeClass ? sizeClass[1] : "regular",
            }
            galleryBuilder.removeYouTubeData(oldId)
            item.attr("data-id", newId).data("id", newId)
            galleryBuilder.updateYouTubeSizing(newId, sizing)
          }

          galleryBuilder.updateYouTubeData(newId, video.meta)
          galleryBuilder.updateImageOrder()
        })
        .fail(function (message) {
          alert(message)
          $input.val(oldUrl)
        })
    },

    // ===== Drag-to-resize handle =====

    /**
     * Corner handle on every builder item and Layout-mode tile. Dragging snaps
     * the cell to whole grid tracks/rows (live), and on release commits through
     * the item's own Width/Height inputs + Apply button, so images, videos and
     * external videos keep their existing save paths.
     */
    bindResizeHandles: function () {
      const grids = $("#gallery-preview, #clearph-layout-grid")
      const addHandles = () => {
        grids.children(".gallery-item, .clearph-layout-tile").each(function () {
          if (!$(this).children(".clearph-resize-handle").length) {
            $(this).append('<span class="clearph-resize-handle" title="Drag to resize" aria-hidden="true"></span>')
          }
        })
      }
      addHandles()
      // Items are added by PHP, the media frame, video URLs and Layout re-renders
      const observer = new MutationObserver(addHandles)
      grids.each(function () {
        observer.observe(this, { childList: true })
      })

      $(document).on("pointerdown", ".clearph-resize-handle", (e) => this.startResize(e))
      // Don't let the click that ends a resize select / open anything
      $(document).on("click", ".clearph-resize-handle", (e) => e.stopPropagation())
    },

    startResize: function (e) {
      const ev = e.originalEvent
      if (ev.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const handle = e.currentTarget
      const $cell = $(handle).parent()
      const grid = $cell.parent()[0]
      const cs = getComputedStyle(grid)
      const tracks = cs.gridTemplateColumns.split(" ").map(parseFloat)
      const track = tracks[0]
      if (!(track > 0)) return
      const maxCols = Math.min(12, tracks.length)
      const colGap = parseFloat(cs.columnGap) || 0
      const rowGap = parseFloat(cs.rowGap) || 0
      const rowH = parseFloat(cs.gridAutoRows) || track

      const isTile = $cell.hasClass("clearph-layout-tile")
      const id = String($cell.attr("data-id"))
      const $source = isTile ? this.getSourceItem(id) : $cell
      if (!$source.length) return

      const rect = $cell[0].getBoundingClientRect()
      const startX = ev.clientX
      const startY = ev.clientY
      const startCol = parseInt($source.find(".grid-column-input").val(), 10) || 2
      const startRow = parseInt($source.find(".grid-row-input").val(), 10) || 2
      let col = startCol
      let row = startRow

      const $readout = $('<span class="clearph-resize-readout"></span>').text(col + " × " + row).appendTo($cell)
      $cell.addClass("is-resizing")
      try {
        handle.setPointerCapture(ev.pointerId) // keep receiving moves outside the handle
      } catch (err) {}

      const move = (m) => {
        const w = rect.width + (m.clientX - startX)
        const h = rect.height + (m.clientY - startY)
        col = Math.max(1, Math.min(maxCols, Math.round((w + colGap) / (track + colGap))))
        row = Math.max(1, Math.min(12, Math.round((h + rowGap) / (rowH + rowGap))))
        $cell.css({ "grid-column": "span " + col, "grid-row": "span " + row })
        $readout.text(col + " × " + row)
      }

      const end = () => {
        handle.removeEventListener("pointermove", move)
        handle.removeEventListener("pointerup", end)
        handle.removeEventListener("pointercancel", end)
        $cell.removeClass("is-resizing")
        $readout.remove()
        if (col === startCol && row === startRow) return

        // Commit via the source item's own controls (AJAX / hidden JSON paths)
        $source.find(".grid-column-input").val(col)
        $source.find(".grid-row-input").val(row)
        $source.find(".grid-apply-btn").first().trigger("click")
        $source.css({ "grid-column": "span " + col, "grid-row": "span " + row })
        if (isTile) {
          this.refreshLayoutTile(id)
          if (String(this.orderModalSelectedId) === id) this.syncPanelInputsFromSource(id)
        } else {
          $('.clearph-layout-tile[data-id="' + id + '"]').css({ "grid-column": "span " + col, "grid-row": "span " + row })
        }
      }

      handle.addEventListener("pointermove", move)
      handle.addEventListener("pointerup", end)
      handle.addEventListener("pointercancel", end)
    },

    // ===== Bulk Layout Algorithms =====

    // Reference gallery width (px) used to turn the gap and image resolution
    // into track units. Proportional rows make cell shapes width-independent,
    // so this only nudges the gap ratio and the "don't upscale" check.
    LAYOUT_REF_WIDTH: 1400,

    /**
     * Shape (width / height) of a cell spanning c micro-columns x r rows with
     * proportional rows (row height = track width). gapRatio = gap / track width.
     */
    cellAspect: function (c, r, gapRatio) {
      return (c + (c - 1) * gapRatio) / (r + (r - 1) * gapRatio)
    },

    // Fraction of the image object-fit: cover hides in a cell of shape cellRatio
    cropFraction: function (imageRatio, cellRatio) {
      return 1 - Math.min(imageRatio / cellRatio, cellRatio / imageRatio)
    },

    /**
     * Cost of giving an item a c x r cell. Lower is better. Crop dominates;
     * the rest keeps sizes in a pleasant range and the layout varied.
     */
    layoutCost: function (item, cand, ctx) {
      const { c, r, crop } = cand
      // Crop dominates, and climbs steeply past ~15%
      let cost = crop * 8 + crop * crop * 20

      if (item.feature) {
        // Features want to be big: 2+ visual columns
        if (c < Math.min(4, ctx.microCols)) cost += 1.5
      } else {
        // Regular items are one visual column (2 micro-cols), so the gallery
        // reads as the column count it's set to. 1.5 columns is an occasional
        // accent; wider costs more again.
        if (c > 2) cost += 1.0 + (c - 3) * 0.45
      }
      if (c * r > 16) cost += (c * r - 16) * 0.06 // even features shouldn't swallow the page
      if (r > 6) cost += (r - 6) * 0.25 // towers

      // Landing flush with a neighbouring column merges flat runs, which keeps
      // the skyline tidy (fewer narrow wells later)
      const top = ctx.level + r
      if (ctx.leftHeight === top || ctx.rightHeight === top) cost -= 0.4

      if (c + "x" + r === ctx.prevKey) cost += 0.25 // avoid runs of identical cells

      // Lookahead: the run this leaves beside it is where the next item lands,
      // so don't leave a slot the next image can't fill without heavy cropping
      const leftover = ctx.runWidth - c
      if (leftover >= 2 && ctx.next) {
        cost += this.bestCropInWidth(ctx.next.ratio, leftover, ctx.gapRatio) * 5
      }

      return cost
    },

    // Least crop an image can get in a run of the given width (any valid c, r)
    bestCropInWidth: function (ratio, width, gapRatio) {
      let best = 1
      for (let c = 2; c <= width; c++) {
        if (width - c === 1) continue
        for (let r = 1; r <= 12; r++) {
          best = Math.min(best, this.cropFraction(ratio, this.cellAspect(c, r, gapRatio)))
        }
      }
      return best
    },

    /**
     * Skyline packing. Items go in order, each onto the lowest, leftmost flat
     * run of the skyline, never wider than that run and never stranding a
     * 1-micro-col sliver. That is exactly where CSS grid auto-placement puts
     * them, and it never leaves a hole, so the page renders as planned.
     *
     * @param {Array} items - [{ id, ratio, width }]
     * @param {Object} opts - { microCols, gapRatio, trackPx, shuffle }
     * @returns {Object} id → { column_span, row_span }
     */
    packLayout: function (items, opts) {
      const M = opts.microCols
      const heights = new Array(M).fill(0)
      const placed = []
      let prevKey = ""
      let sinceFeature = 99

      items.forEach((item, index) => {
        const level = Math.min(...heights)
        const start = heights.indexOf(level)
        let runWidth = 0
        while (start + runWidth < M && heights[start + runWidth] === level) runWidth++

        // Feature (hero) slots: a big cell every so often, only for images with
        // enough resolution to fill it
        const bigEnough = !item.width || item.width >= 1600
        const roomy = runWidth >= Math.min(4, M) && M >= 6
        if (opts.shuffle) {
          item.feature = roomy && bigEnough && sinceFeature >= 4 && Math.random() < 0.3
        } else {
          item.feature = roomy && bigEnough && runWidth === M && (index === 0 || sinceFeature >= 6)
        }

        const ctx = {
          microCols: M,
          gapRatio: opts.gapRatio,
          runWidth: runWidth,
          next: items[index + 1],
          level: level,
          leftHeight: start > 0 ? heights[start - 1] : null,
          rightHeight: start + runWidth < M ? heights[start + runWidth] : null,
          prevKey: prevKey,
        }

        const candidates = []
        for (let c = 2; c <= runWidth; c++) {
          if (runWidth - c === 1) continue
          // Don't stretch an image much past its own pixel width
          const cellPx = c * opts.trackPx + (c - 1) * opts.gapPx
          if (item.width && cellPx > item.width * 1.15 && c > 2) continue
          for (let r = 1; r <= 12; r++) {
            const crop = this.cropFraction(item.ratio, this.cellAspect(c, r, opts.gapRatio))
            const cand = { c: c, r: r, crop: crop }
            cand.cost = this.layoutCost(item, cand, ctx)
            candidates.push(cand)
          }
        }

        const best = candidates.reduce((a, b) => (b.cost < a.cost ? b : a))
        let pick = best
        if (opts.shuffle) {
          // Sample among near-best options, favouring the better ones
          const pool = candidates.filter((cand) => cand.cost <= best.cost + 1.2 && cand.crop <= Math.max(0.22, best.crop))
          pick = this.weightedPick(pool.map((cand) => Object.assign({}, cand, { weight: Math.exp(-(cand.cost - best.cost) * 2) })))
        }

        for (let k = start; k < start + pick.c; k++) heights[k] = level + pick.r
        placed.push({ id: item.id, ratio: item.ratio, start: start, c: pick.c, r: pick.r, top: level })
        prevKey = pick.c + "x" + pick.r
        sinceFeature = item.feature && pick.c >= 4 ? 0 : sinceFeature + 1
      })

      // Even out the bottom edge: stretch the topmost item of each column run
      // down to the deepest column when that doesn't crop it badly
      const maxH = Math.max(...heights)
      placed.forEach((p) => {
        const bottom = p.top + p.r
        if (bottom >= maxH) return
        for (let k = p.start; k < p.start + p.c; k++) {
          if (heights[k] !== bottom) return
        }
        const r = maxH - p.top
        if (r > 12) return
        if (this.cropFraction(p.ratio, this.cellAspect(p.c, r, opts.gapRatio)) > 0.3) return
        p.r = r
        for (let k = p.start; k < p.start + p.c; k++) heights[k] = maxH
      })

      const result = {}
      placed.forEach((p) => {
        result[p.id] = { column_span: p.c, row_span: p.r }
      })
      return result
    },

    weightedPick: function (candidates) {
      const totalWeight = candidates.reduce((sum, c) => sum + (c.weight || 1), 0)
      let r = Math.random() * totalWeight
      for (const c of candidates) {
        r -= c.weight || 1
        if (r <= 0) return c
      }
      return candidates[candidates.length - 1]
    },

    // Bulk layouts overwrite every item's sizing; ask once per page load
    bulkLayoutConfirmed: false,

    confirmBulkLayout: function () {
      if (this.bulkLayoutConfirmed) return true
      if (!confirm("This will resize every item in the gallery based on image proportions. Continue?")) return false
      this.bulkLayoutConfirmed = true
      return true
    },

    /**
     * Ratio-based layout — fetch image dimensions, then skyline-pack cells
     * shaped to each image (proportional rows).
     * @param {string} mode - "auto" (lowest-cost fit, same result every time) |
     *                        "shuffle" (samples near-best fits, new arrangement each click)
     */
    ratioLayout: function (mode) {
      const $items = $("#gallery-preview .gallery-item")
      if (!$items.length) return
      if (!this.confirmBulkLayout()) return
      const shuffle = mode === "shuffle"

      const columns = parseInt($("#columns").val(), 10) || 4
      const microCols = columns * 2
      const margin = String($("#column_margin").val() || "").trim()
      const gapPx = /^\d+(\.\d+)?(px)?$/.test(margin) ? parseFloat(margin) : 20
      const trackPx = (this.LAYOUT_REF_WIDTH - (microCols - 1) * gapPx) / microCols

      // Collect attachment IDs (YouTube items carry their own shape)
      const items = []
      const imageIds = []
      $items.each(function () {
        const id = String($(this).data("id"))
        items.push({ id: id })
        if (!galleryBuilder.isExternalVideo(id)) {
          imageIds.push(id)
        }
      })

      // Show loading state
      const $grid = $("#clearph-layout-grid, #gallery-preview")
      const $buttons = $(".clearph-auto-masonry, .clearph-shuffle-masonry")
      $grid.css("opacity", "0.5")
      $buttons.prop("disabled", true)

      const fetchMetadata = imageIds.length
        ? $.post(clearph_admin.ajax_url, {
            action: "clearph_get_images_metadata",
            nonce: clearph_admin.nonce,
            image_ids: JSON.stringify(imageIds),
          })
        : $.Deferred().resolve({ success: true, data: {} }).promise()

      fetchMetadata
        .done((response) => {
          const meta = response.success ? response.data : {}
          const ytItems = this.getYouTubeItems()

          items.forEach((item) => {
            if (galleryBuilder.isExternalVideo(item.id)) {
              const ytData = ytItems[item.id] || {}
              if (ytData.width && ytData.height) {
                item.ratio = ytData.width / ytData.height // Vimeo: real size from oEmbed
              } else {
                item.ratio = ytData.is_short ? 0.5625 : 1.778 // YouTube: 9:16 or 16:9
              }
              item.width = 1920
            } else if (meta[item.id]) {
              item.ratio = meta[item.id].aspect_ratio
              item.width = meta[item.id].width
            } else {
              item.ratio = 1.0 // Unknown, treat as square
            }
          })

          const sizingMap = this.packLayout(items, {
            microCols: microCols,
            gapPx: gapPx,
            trackPx: trackPx,
            gapRatio: gapPx / trackPx,
            shuffle: shuffle,
          })
          this.applyBulkSizing(sizingMap, { rowHeight: "proportional" })
        })
        .fail(() => {
          alert("Failed to fetch image metadata. Please try again.")
        })
        .always(() => {
          $grid.css("opacity", "")
          $buttons.prop("disabled", false)
        })
    },

    /**
     * Proportional rows in the admin previews, mirroring the frontend: each
     * row is as tall as one track is wide. Fixed mode clears the override so
     * the stylesheet row height applies.
     */
    syncRowHeights: function () {
      const proportional = $("#row_height").val() === "proportional" && $("#masonry_enabled").is(":checked")
      $("#gallery-preview, #clearph-layout-grid").each(function () {
        if (!proportional) {
          this.style.gridAutoRows = ""
          return
        }
        const track = parseFloat(getComputedStyle(this).gridTemplateColumns)
        if (track > 0) this.style.gridAutoRows = track + "px"
      })
    },

    bindRowHeights: function () {
      const sync = () => this.syncRowHeights()
      $("#row_height, #columns, #masonry_enabled").on("change", () => setTimeout(sync, 0))
      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(sync)
        $("#gallery-preview, #clearph-layout-grid").each(function () {
          observer.observe(this)
        })
      } else {
        $(window).on("resize", sync)
      }
      sync()
    },

    /**
     * Apply a sizing map to all gallery items (batch update).
     * @param {Object} sizingMap - { id: { column_span, row_span }, ... }
     * @param {Object} [opts] - { rowHeight: "proportional" } also switches the
     *                          gallery's row height (saved with the sizes)
     */
    applyBulkSizing: function (sizingMap, opts) {
      opts = opts || {}
      if (opts.rowHeight) {
        $("#row_height").val(opts.rowHeight)
        this.syncRowHeights()
      }
      const imageSizing = {}
      const ytSizing = {}

      // Split by type
      Object.keys(sizingMap).forEach((id) => {
        if (galleryBuilder.isExternalVideo(id)) {
          ytSizing[id] = sizingMap[id]
        } else {
          imageSizing[id] = sizingMap[id]
        }
      })

      // Update YouTube items via hidden JSON field
      Object.keys(ytSizing).forEach((ytId) => {
        const sizing = ytSizing[ytId]
        this.updateYouTubeSizing(ytId, {
          column_span: sizing.column_span,
          row_span: sizing.row_span,
          masonry_size: "custom",
        })
      })

      // Update all source items in the DOM
      Object.keys(sizingMap).forEach((id) => {
        const sizing = sizingMap[id]
        const $source = this.getSourceItem(id)
        if (!$source.length) return

        // Update input values
        $source.find(".grid-column-input").val(sizing.column_span)
        $source.find(".grid-row-input").val(sizing.row_span)

        // Update inline grid styles
        $source.css({
          "grid-column": "span " + sizing.column_span,
          "grid-row": "span " + sizing.row_span,
        })

        // Clear preset size classes and active buttons
        $source.removeClass("size-regular size-tall size-wide size-large size-xl")
        $source.find(".size-btn").removeClass("active")
      })

      // Sync image sizing to hidden field and batch AJAX
      if (Object.keys(imageSizing).length) {
        // Update hidden field
        var allSizing = this.getImageSizing()
        Object.keys(imageSizing).forEach((id) => {
          allSizing[id] = imageSizing[id]
        })
        $("#image_sizing").val(JSON.stringify(allSizing))

        // Batch AJAX
        $.post(clearph_admin.ajax_url, {
          action: "clearph_batch_update_sizing",
          nonce: clearph_admin.nonce,
          post_id: clearph_admin.post_id,
          sizing: JSON.stringify(imageSizing),
          row_height: opts.rowHeight || "",
        })
      }

      // Re-render the layout view
      this.renderLayoutView()
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
