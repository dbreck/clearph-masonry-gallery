<?php
/**
 * GitHub Plugin Updater
 *
 * Checks GitHub releases for plugin updates and integrates
 * with the WordPress plugin update system.
 *
 * @package ClearPH_Masonry_Gallery
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ClearPH_GitHub_Updater {

	/**
	 * Plugin slug.
	 *
	 * @var string
	 */
	private $slug;

	/**
	 * Plugin data from the main plugin file header.
	 *
	 * @var array
	 */
	private $plugin_data;

	/**
	 * GitHub repo in "owner/repo" format.
	 *
	 * @var string
	 */
	private $repo;

	/**
	 * Main plugin file path relative to plugins directory.
	 *
	 * @var string
	 */
	private $plugin_file;

	/**
	 * Cached GitHub API response.
	 *
	 * @var object|null
	 */
	private $github_response;

	/**
	 * Constructor.
	 *
	 * @param string $plugin_file Full path to the main plugin file.
	 * @param string $repo        GitHub repo in "owner/repo" format.
	 */
	public function __construct( $plugin_file, $repo ) {
		$this->plugin_file = plugin_basename( $plugin_file );
		$this->slug        = dirname( $this->plugin_file );
		$this->repo        = $repo;

		add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_update' ) );
		add_filter( 'plugins_api', array( $this, 'plugin_info' ), 20, 3 );
		add_filter( 'upgrader_post_install', array( $this, 'after_install' ), 10, 3 );
	}

	/**
	 * Get plugin data from the file header.
	 *
	 * @return array
	 */
	private function get_plugin_data() {
		if ( ! $this->plugin_data ) {
			$this->plugin_data = get_plugin_data( WP_PLUGIN_DIR . '/' . $this->plugin_file );
		}
		return $this->plugin_data;
	}

	/**
	 * Fetch the latest release from GitHub API.
	 *
	 * @return object|false Release object or false on failure.
	 */
	private function get_github_release() {
		if ( null !== $this->github_response ) {
			return $this->github_response;
		}

		$url      = "https://api.github.com/repos/{$this->repo}/releases/latest";
		$response = wp_remote_get(
			$url,
			array(
				'headers' => array(
					'Accept' => 'application/vnd.github.v3+json',
				),
				'timeout' => 10,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			$this->github_response = false;
			return false;
		}

		$this->github_response = json_decode( wp_remote_retrieve_body( $response ) );
		return $this->github_response;
	}

	/**
	 * Check for plugin updates via GitHub releases.
	 *
	 * @param object $transient The update_plugins transient.
	 * @return object Modified transient.
	 */
	public function check_update( $transient ) {
		if ( empty( $transient->checked ) ) {
			return $transient;
		}

		$release = $this->get_github_release();
		if ( ! $release || empty( $release->tag_name ) ) {
			return $transient;
		}

		$github_version  = ltrim( $release->tag_name, 'v' );
		$current_version = $this->get_plugin_data()['Version'];

		if ( version_compare( $github_version, $current_version, '>' ) ) {
			$download_url = $release->zipball_url;

			$transient->response[ $this->plugin_file ] = (object) array(
				'slug'        => $this->slug,
				'plugin'      => $this->plugin_file,
				'new_version' => $github_version,
				'url'         => "https://github.com/{$this->repo}",
				'package'     => $download_url,
			);
		}

		return $transient;
	}

	/**
	 * Provide plugin information for the update details modal.
	 *
	 * @param false|object|array $result The result object or array.
	 * @param string             $action The API action being performed.
	 * @param object             $args   Plugin API arguments.
	 * @return false|object
	 */
	public function plugin_info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || $this->slug !== $args->slug ) {
			return $result;
		}

		$release = $this->get_github_release();
		if ( ! $release ) {
			return $result;
		}

		$plugin_data = $this->get_plugin_data();

		return (object) array(
			'name'          => $plugin_data['Name'],
			'slug'          => $this->slug,
			'version'       => ltrim( $release->tag_name, 'v' ),
			'author'        => $plugin_data['Author'],
			'homepage'      => "https://github.com/{$this->repo}",
			'download_link' => $release->zipball_url,
			'sections'      => array(
				'description' => $plugin_data['Description'],
				'changelog'   => nl2br( esc_html( $release->body ) ),
			),
		);
	}

	/**
	 * Rename the extracted folder to match the plugin slug after install.
	 *
	 * GitHub's zipball extracts to "owner-repo-hash/" which won't match
	 * the expected plugin directory name.
	 *
	 * @param bool  $response   Installation response.
	 * @param array $hook_extra Extra arguments passed to hooked filters.
	 * @param array $result     Installation result data.
	 * @return array Modified result.
	 */
	public function after_install( $response, $hook_extra, $result ) {
		if ( ! isset( $hook_extra['plugin'] ) || $hook_extra['plugin'] !== $this->plugin_file ) {
			return $result;
		}

		global $wp_filesystem;

		$proper_destination = WP_PLUGIN_DIR . '/' . $this->slug;

		$wp_filesystem->move( $result['destination'], $proper_destination );
		$result['destination'] = $proper_destination;

		// Re-activate plugin if it was active.
		if ( is_plugin_active( $this->plugin_file ) ) {
			activate_plugin( $this->plugin_file );
		}

		return $result;
	}
}
