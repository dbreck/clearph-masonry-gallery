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
      $("#add-youtube").on("click", this.addYouTubeVideo)
      $("#clear-gallery").on("click", this.clearGallery)
      $(document).on("click", ".remove-item", this.removeItem)
      $(document).on("click", ".size-btn", this.updateMasonrySize)
      $(document).on("click", ".grid-apply-btn", this.applyGridSizing)
      $(document).on("change", ".youtube-url-input", this.updateYouTubeUrl)
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
      if (String(imageId).indexOf("yt_") === 0) return

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
      if (itemId.indexOf("yt_") === 0) {
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
      if (imageId.indexOf("yt_") === 0) {
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
      if (imageId.indexOf("yt_") === 0) {
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
        if (typeof imageId === "string" && imageId.indexOf("yt_") === 0) return

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

        if (!imageId || (typeof imageId === "string" && imageId.indexOf("yt_") === 0)) return

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

      // Bulk layout buttons (Layout mode only)
      $("#clearph-randomize-layout").on("click", () => this.randomizeLayout())
      $("#clearph-smart-layout").on("click", () => this.smartLayout())

      // Mode switch tabs
      $(document).on("click", ".clearph-mode-btn", (e) => {
        e.preventDefault()
        const mode = $(e.currentTarget).data("mode")
        this.switchModalMode(mode)
      })

      // Layout tile click = select
      $(document).on("click", ".clearph-layout-tile", (e) => {
        const id = $(e.currentTarget).attr("data-id")
        this.selectLayoutTile(id)
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

        const $tile = $('<div class="clearph-order-tile"></div>')
          .attr("data-id", id)
          .attr("data-type", type)

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

        if (type === "video") {
          $tile.append('<span class="clearph-order-tile__badge clearph-order-tile__badge--video">Video</span>')
        } else if (type === "youtube") {
          $tile.append('<span class="clearph-order-tile__badge clearph-order-tile__badge--youtube">YT</span>')
        }

        $grid.append($tile)
      })

      // (Re)initialize sortable
      if ($grid.data("ui-sortable")) {
        $grid.sortable("destroy")
      }
      $grid.sortable({
        items: "> .clearph-order-tile",
        tolerance: "pointer",
        forcePlaceholderSize: true,
        placeholder: "clearph-order-modal__placeholder",
        update: () => this.refreshOrderModalIndexes(),
      })
    },

    renderLayoutView: function () {
      const $grid = $("#clearph-layout-grid")
      $grid.empty()

      const columns = parseInt($("#columns").val(), 10) || 4
      const microCols = columns * 2
      document.documentElement.style.setProperty("--clearph-layout-micro-cols", microCols)

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
        } else if (type === "youtube") {
          $tile.append('<span class="clearph-layout-tile__badge clearph-layout-tile__badge--youtube">YT</span>')
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
      $(".clearph-layout-tile").removeClass("is-selected")
      $('.clearph-layout-tile[data-id="' + id + '"]').addClass("is-selected")
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
      $(".clearph-layout-panel__section--youtube").toggle(type === "youtube")
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
      this.orderModalSelectedId = null
      this.orderModalMode = "order"
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

    addYouTubeVideo: function (e) {
      e.preventDefault()
      var url = prompt("Enter a YouTube video URL:")
      if (!url) return

      var videoId = galleryBuilder.extractYouTubeId(url)
      if (!videoId) {
        alert("Could not parse a YouTube video ID from that URL. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/")
        return
      }

      var ytId = "yt_" + videoId
      var preview = $("#gallery-preview")

      // Skip if already in gallery
      if (preview.find('[data-id="' + ytId + '"]').length) {
        alert("This YouTube video is already in the gallery.")
        return
      }

      galleryBuilder.saveCurrentOrder()

      var isShort = galleryBuilder.isYouTubeShort(url)
      var defaultSize = isShort ? "tall" : "regular"
      var sizeMap = {
        regular: { column: 2, row: 2 },
        tall: { column: 2, row: 4 },
      }
      var defaultSizing = sizeMap[defaultSize] || sizeMap.regular

      var template = wp.template("youtube-item")
      var itemData = {
        yt_id: ytId,
        video_id: videoId,
        url: url,
        thumb: "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg",
        masonry_size: defaultSize,
        column_span: defaultSizing.column,
        row_span: defaultSizing.row,
      }

      var itemHtml = template(itemData)
      preview.append(itemHtml)

      // Store YouTube data in hidden fields
      galleryBuilder.updateYouTubeData(ytId, {
        video_id: videoId,
        url: url,
        is_short: isShort,
      })
      galleryBuilder.updateYouTubeSizing(ytId, {
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

    updateYouTubeUrl: function () {
      var $input = $(this)
      var item = $input.closest(".gallery-item")
      var oldId = String(item.data("id"))
      var newUrl = $input.val().trim()

      if (!newUrl) return

      var newVideoId = galleryBuilder.extractYouTubeId(newUrl)
      if (!newVideoId) {
        alert("Could not parse a YouTube video ID from that URL.")
        $input.val(item.find(".image-filename").text().replace("YouTube: ", ""))
        return
      }

      var newYtId = "yt_" + newVideoId
      var isShort = galleryBuilder.isYouTubeShort(newUrl)

      // Update thumbnail
      item.find(".image-container img").attr("src", "https://img.youtube.com/vi/" + newVideoId + "/hqdefault.jpg")
      item.find(".image-filename").text("YouTube: " + newVideoId)

      // If video ID changed, update data-id and hidden fields
      if (newYtId !== oldId) {
        // Remove old data
        galleryBuilder.removeYouTubeData(oldId)

        // Update DOM
        item.attr("data-id", newYtId).data("id", newYtId)

        // Preserve existing sizing
        var columnSpan = parseInt(item.find(".grid-column-input").val()) || 2
        var rowSpan = parseInt(item.find(".grid-row-input").val()) || 2
        var sizeClass = (item.attr("class") || "").match(/size-(regular|tall|wide|large|xl)/)
        var masonrySize = sizeClass ? sizeClass[1] : "regular"

        galleryBuilder.updateYouTubeSizing(newYtId, {
          column_span: columnSpan,
          row_span: rowSpan,
          masonry_size: masonrySize,
        })
      }

      // Update YouTube data
      galleryBuilder.updateYouTubeData(newYtId, {
        video_id: newVideoId,
        url: newUrl,
        is_short: isShort,
      })

      // Update image order to reflect any ID change
      galleryBuilder.updateImageOrder()
    },

    // ===== Bulk Layout Algorithms =====

    /**
     * Generate a row-packed layout that tiles perfectly (no gaps).
     * @param {Array} items  - array of { id, ... } (one per gallery item)
     * @param {number} microCols - total micro-columns for the gallery
     * @param {Function} getSizes - (item, remaining, index, items) => array of { col, row, weight }
     * @returns {Object} map of id → { column_span, row_span }
     */
    generatePackedLayout: function (items, microCols, getSizes) {
      const result = {}
      let i = 0
      const consecutiveR = { count: 0 }
      let lastWasXL = false

      while (i < items.length) {
        let remaining = microCols

        while (remaining > 0 && i < items.length) {
          let candidates = getSizes(items[i], remaining, i, items)

          // Filter to sizes that fit remaining space
          candidates = candidates.filter((c) => c.col <= remaining)

          // Rhythm rules
          if (lastWasXL) {
            candidates = candidates.filter((c) => c.col < microCols)
          }
          if (consecutiveR.count >= 3) {
            const nonR = candidates.filter((c) => !(c.col === 2 && c.row === 2))
            if (nonR.length) candidates = nonR
          }

          // If nothing fits (shouldn't happen, but safety), expand previous item
          if (!candidates.length) {
            break
          }

          // Weighted random pick
          const pick = this.weightedPick(candidates)

          // Track rhythm
          if (pick.col === 2 && pick.row === 2) {
            consecutiveR.count++
          } else {
            consecutiveR.count = 0
          }
          lastWasXL = pick.col >= microCols

          result[items[i].id] = { column_span: pick.col, row_span: pick.row }
          remaining -= pick.col
          i++

          // If remaining is too small for the minimum size (1 micro-col), expand last item
          if (remaining > 0 && remaining < 2 && i <= items.length) {
            const lastId = items[i - 1].id
            result[lastId].column_span += remaining
            remaining = 0
          }
        }
      }

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

    /**
     * Randomize Layout — weighted random sizes with row-packing.
     */
    randomizeLayout: function () {
      const $items = $("#gallery-preview .gallery-item")
      if (!$items.length) return
      if (!confirm("This will resize all items in the gallery. Continue?")) return

      const columns = parseInt($("#columns").val(), 10) || 4
      const microCols = columns * 2
      const itemCount = $items.length

      // Build item list
      const items = []
      $items.each(function () {
        items.push({ id: String($(this).data("id")) })
      })

      // Size pool — weights adjusted by gallery size
      const getSizes = (item, remaining, index) => {
        const pool = []

        // R (2x2) — always available, workhorse
        pool.push({ col: 2, row: 2, weight: 40 })

        // T (2x4) — vertical accent
        pool.push({ col: 2, row: 4, weight: 15 })

        // W (4x2) — horizontal accent (only if grid is wide enough)
        if (microCols >= 4) {
          pool.push({ col: 4, row: 2, weight: 15 })
        }

        // L (4x4) — hero anchor
        if (microCols >= 4) {
          pool.push({ col: 4, row: 4, weight: itemCount <= 8 ? 15 : 10 })
        }

        // XL (full width x 6) — dramatic, rare
        if (microCols > 4 && itemCount >= 10) {
          pool.push({ col: microCols, row: 6, weight: 3 })
        }

        // Boost non-R for the first row to create a visual hook
        if (index === 0) {
          pool.forEach((p) => {
            if (!(p.col === 2 && p.row === 2)) p.weight *= 2
          })
        }

        return pool
      }

      const sizingMap = this.generatePackedLayout(items, microCols, getSizes)
      this.applyBulkSizing(sizingMap)
    },

    /**
     * Smart Layout — fetch image aspect ratios, assign best-fit sizes.
     */
    smartLayout: function () {
      const $items = $("#gallery-preview .gallery-item")
      if (!$items.length) return
      if (!confirm("This will resize all items based on image proportions. Continue?")) return

      const columns = parseInt($("#columns").val(), 10) || 4
      const microCols = columns * 2

      // Collect attachment IDs (skip YouTube items — handled separately)
      const items = []
      const imageIds = []
      $items.each(function () {
        const id = String($(this).data("id"))
        items.push({ id: id, type: $(this).data("type") || "image" })
        if (id.indexOf("yt_") !== 0) {
          imageIds.push(id)
        }
      })

      // Show loading state
      const $grid = $("#clearph-layout-grid")
      $grid.css("opacity", "0.5")

      // Fetch metadata for images
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

          // Classify YouTube items using stored data
          const ytItems = this.getYouTubeItems()

          // Assign aspect ratio info to each item
          items.forEach((item) => {
            if (item.id.indexOf("yt_") === 0) {
              // YouTube: check is_short flag
              const ytData = ytItems[item.id]
              item.ratio = ytData && ytData.is_short ? 0.5625 : 1.778 // 9:16 or 16:9
            } else if (meta[item.id]) {
              item.ratio = meta[item.id].aspect_ratio
              item.resolution = meta[item.id].width * meta[item.id].height
            } else {
              item.ratio = 1.0 // Unknown, treat as square
            }
          })

          // Find hero image (highest resolution)
          let heroId = null
          let maxRes = 0
          items.forEach((item) => {
            if (item.resolution && item.resolution > maxRes) {
              maxRes = item.resolution
              heroId = item.id
            }
          })

          // Count distribution for variety injection
          const buckets = { wide: 0, landscape: 0, square: 0, portrait: 0, tall: 0 }
          items.forEach((item) => {
            const b = this.classifyAspectRatio(item.ratio)
            buckets[b]++
          })
          const dominant = Object.keys(buckets).reduce((a, b) => (buckets[a] >= buckets[b] ? a : b))
          const isUniform = buckets[dominant] / items.length > 0.6

          const getSizes = (item, remaining, index) => {
            const classification = this.classifyAspectRatio(item.ratio)
            const pool = []

            // Hero boost: first item or hero image gets a large size
            if (item.id === heroId && index < 3 && microCols >= 4) {
              pool.push({ col: 4, row: 4, weight: 50 })
              if (microCols > 4 && items.length >= 10) {
                pool.push({ col: microCols, row: 6, weight: 20 })
              }
            }

            // Best-fit sizes based on aspect ratio
            switch (classification) {
              case "wide":
                if (microCols >= 6) pool.push({ col: 6, row: 2, weight: 30 })
                if (microCols >= 4) pool.push({ col: 4, row: 2, weight: 40 })
                pool.push({ col: 2, row: 2, weight: 5 })
                break
              case "landscape":
                if (microCols >= 4) pool.push({ col: 4, row: 2, weight: 35 })
                pool.push({ col: 2, row: 2, weight: 20 })
                if (microCols >= 4) pool.push({ col: 4, row: 3, weight: 10 })
                break
              case "square":
                pool.push({ col: 2, row: 2, weight: 35 })
                if (microCols >= 4) pool.push({ col: 4, row: 4, weight: 15 })
                pool.push({ col: 2, row: 3, weight: 10 })
                break
              case "portrait":
                pool.push({ col: 2, row: 4, weight: 35 })
                pool.push({ col: 2, row: 3, weight: 20 })
                pool.push({ col: 2, row: 2, weight: 5 })
                break
              case "tall":
                pool.push({ col: 2, row: 4, weight: 40 })
                pool.push({ col: 2, row: 6, weight: 15 })
                pool.push({ col: 2, row: 3, weight: 10 })
                break
            }

            // Variety injection for uniform galleries
            if (isUniform && classification === dominant) {
              // Add some contrasting sizes
              if (classification !== "portrait" && classification !== "tall") {
                pool.push({ col: 2, row: 4, weight: 12 })
              }
              if (classification !== "wide" && classification !== "landscape" && microCols >= 4) {
                pool.push({ col: 4, row: 2, weight: 12 })
              }
            }

            // Ensure at least one option
            if (!pool.length) {
              pool.push({ col: 2, row: 2, weight: 1 })
            }

            return pool
          }

          const sizingMap = this.generatePackedLayout(items, microCols, getSizes)
          this.applyBulkSizing(sizingMap)
        })
        .fail(() => {
          alert("Failed to fetch image metadata. Please try again.")
        })
        .always(() => {
          $grid.css("opacity", "")
        })
    },

    classifyAspectRatio: function (ratio) {
      if (ratio >= 2.0) return "wide"
      if (ratio >= 1.3) return "landscape"
      if (ratio >= 0.8) return "square"
      if (ratio >= 0.5) return "portrait"
      return "tall"
    },

    /**
     * Apply a sizing map to all gallery items (batch update).
     * @param {Object} sizingMap - { id: { column_span, row_span }, ... }
     */
    applyBulkSizing: function (sizingMap) {
      const imageSizing = {}
      const ytSizing = {}

      // Split by type
      Object.keys(sizingMap).forEach((id) => {
        if (id.indexOf("yt_") === 0) {
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
